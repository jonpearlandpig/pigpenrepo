import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getServiceClient, uploadFile } from "@/lib/supabase";
import { extractTextFromBuffer, detectFileType, validateExtraction } from "@/lib/parser/document-parser";
import { extractProductionRider } from "@/lib/claude/extraction-client";
import type { ApiError } from "@/lib/types";

// POST /api/akb — upload a production rider and extract AKB entries
// Accepts multipart/form-data: file + tour_id
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  // Resolve user + check role
  const { data: user } = await db.from("users").select("id, role").eq("email", session.user.email).single();
  if (!user || (user.role !== "PM" && user.role !== "ADMIN")) {
    return NextResponse.json<ApiError>({ error: "Only PMs and Admins can upload production riders" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json<ApiError>({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const tourId = formData.get("tour_id")?.toString();
  const file = formData.get("file") as File | null;

  if (!tourId || !file) {
    return NextResponse.json<ApiError>({ error: "tour_id and file are required" }, { status: 400 });
  }

  // Ensure tour exists and AKB is not yet locked
  const { data: tour } = await db.from("tours").select("id, name, akb_locked").eq("id", tourId).single();
  if (!tour) return NextResponse.json<ApiError>({ error: "Tour not found" }, { status: 404 });
  if (tour.akb_locked) {
    return NextResponse.json<ApiError>({ error: "AKB is locked. Unlock it before uploading a new rider." }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = detectFileType(file.name, file.type);

  // Extract text
  let rawText: string;
  try {
    rawText = await extractTextFromBuffer(buffer, fileType);
  } catch (e) {
    return NextResponse.json<ApiError>({ error: `Failed to extract text: ${(e as Error).message}` }, { status: 422 });
  }

  const validation = validateExtraction(rawText);
  if (!validation.valid) {
    return NextResponse.json<ApiError>({ error: validation.reason! }, { status: 422 });
  }

  // Upload original file to storage
  const filePath = await uploadFile("production-riders", file.name, buffer, file.type);

  // Save rider record
  const { data: rider, error: riderErr } = await db
    .from("production_riders")
    .insert({ tour_id: tourId, file_name: file.name, file_url: filePath, file_type: fileType, raw_text: rawText, uploaded_by: user.id })
    .select()
    .single();

  if (riderErr) {
    return NextResponse.json<ApiError>({ error: riderErr.message }, { status: 500 });
  }

  // Run Claude extraction
  let extraction;
  try {
    extraction = await extractProductionRider(rawText, tour.name);
  } catch (e) {
    await db.from("production_riders").update({ processing_error: (e as Error).message }).eq("id", rider.id);
    return NextResponse.json<ApiError>({ error: `AI extraction failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Clear existing AKB entries for this tour (re-upload replaces)
  await db.from("akb_entries").delete().eq("tour_id", tourId);

  // Insert extracted specs as AKB entries
  if (extraction.specs.length > 0) {
    const rows = extraction.specs.map((spec) => ({
      tour_id: tourId,
      rider_id: rider.id,
      category: spec.category,
      key: spec.key,
      value: spec.value,
      unit: spec.unit ?? null,
      source_text: spec.source_text,
      confidence: spec.confidence,
    }));

    // Upsert to handle duplicates from same rider
    await db.from("akb_entries").upsert(rows, { onConflict: "tour_id,category,key" });
  }

  // Mark rider as processed
  await db.from("production_riders").update({ processed: true }).eq("id", rider.id);

  return NextResponse.json({
    rider_id: rider.id,
    extracted_count: extraction.specs.length,
    contacts_found: extraction.contacts.length,
    summary: extraction.raw_summary,
  }, { status: 201 });
}

// POST /api/akb/lock — lock the AKB for a tour
export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data: user } = await db.from("users").select("id, role").eq("email", session.user.email).single();
  if (!user || (user.role !== "PM" && user.role !== "ADMIN")) {
    return NextResponse.json<ApiError>({ error: "Only PMs and Admins can lock the AKB" }, { status: 403 });
  }

  const { tour_id, lock } = await req.json();
  if (!tour_id) return NextResponse.json<ApiError>({ error: "tour_id required" }, { status: 400 });

  const { data, error } = await db
    .from("tours")
    .update({
      akb_locked: lock !== false,
      akb_locked_by: lock !== false ? user.id : null,
      akb_locked_at: lock !== false ? new Date().toISOString() : null,
    })
    .eq("id", tour_id)
    .select()
    .single();

  if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
