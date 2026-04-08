// POST /api/venues/packet — upload a tech packet for a venue, extract specs, run gap analysis
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getServiceClient, uploadFile } from "@/lib/supabase";
import { extractTextFromBuffer, detectFileType, validateExtraction } from "@/lib/parser/document-parser";
import { extractVenueTechPacket } from "@/lib/claude/extraction-client";
import { runGapAnalysis } from "@/lib/compare/gap-analyzer";
import { sendGapAlert } from "@/lib/notify/notifier";
import type { ApiError } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data: user } = await db.from("users").select("id, role").eq("email", session.user.email).single();
  if (!user) return NextResponse.json<ApiError>({ error: "User not found" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json<ApiError>({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const venueId = formData.get("venue_id")?.toString();
  const file = formData.get("file") as File | null;
  if (!venueId || !file) {
    return NextResponse.json<ApiError>({ error: "venue_id and file are required" }, { status: 400 });
  }

  // Load venue + tour
  const { data: venue } = await db
    .from("venues")
    .select("id, venue_name, city, tour_id")
    .eq("id", venueId)
    .single();
  if (!venue) return NextResponse.json<ApiError>({ error: "Venue not found" }, { status: 404 });

  // Ensure AKB is locked before we allow packet uploads
  const { data: tour } = await db.from("tours").select("id, name, akb_locked").eq("id", venue.tour_id).single();
  if (!tour) return NextResponse.json<ApiError>({ error: "Tour not found" }, { status: 404 });
  if (!tour.akb_locked) {
    return NextResponse.json<ApiError>({ error: "AKB must be locked before uploading venue tech packets." }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = detectFileType(file.name, file.type);

  let rawText: string;
  try {
    rawText = await extractTextFromBuffer(buffer, fileType);
  } catch (e) {
    return NextResponse.json<ApiError>({ error: `Text extraction failed: ${(e as Error).message}` }, { status: 422 });
  }

  const validation = validateExtraction(rawText);
  if (!validation.valid) {
    return NextResponse.json<ApiError>({ error: validation.reason! }, { status: 422 });
  }

  // Upload file to storage
  const filePath = await uploadFile("tech-packets", file.name, buffer, file.type);

  // Save packet record
  const { data: packet, error: packetErr } = await db
    .from("tech_packets")
    .insert({
      venue_id: venueId,
      file_name: file.name,
      file_url: filePath,
      file_type: fileType,
      raw_text: rawText,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (packetErr) return NextResponse.json<ApiError>({ error: packetErr.message }, { status: 500 });

  // Extract venue specs with Claude
  let extraction;
  try {
    extraction = await extractVenueTechPacket(rawText, venue.venue_name, venue.city);
  } catch (e) {
    await db.from("tech_packets").update({ processing_error: (e as Error).message }).eq("id", packet.id);
    return NextResponse.json<ApiError>({ error: `AI extraction failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Store venue specs
  if (extraction.specs.length > 0) {
    const rows = extraction.specs.map((spec) => ({
      venue_id: venueId,
      packet_id: packet.id,
      category: spec.category,
      key: spec.key,
      value: spec.value,
      unit: spec.unit ?? null,
      source_text: spec.source_text,
      confidence: spec.confidence,
    }));
    await db.from("venue_specs").insert(rows);
  }

  // Store venue contacts
  if (extraction.contacts.length > 0) {
    const contactRows = extraction.contacts.map((c) => ({
      venue_id: venueId,
      role: c.role,
      name: c.name ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      source: "TECH_PACKET" as const,
    }));
    await db.from("venue_contacts").upsert(contactRows, { onConflict: "venue_id,role" });
  }

  await db.from("tech_packets").update({ processed: true }).eq("id", packet.id);

  // Run gap analysis
  let gapResult;
  try {
    gapResult = await runGapAnalysis(venueId, packet.id, venue.tour_id);
  } catch (e) {
    // Gap analysis failure is non-fatal — packet still uploaded and extracted
    return NextResponse.json({
      packet_id: packet.id,
      extracted_count: extraction.specs.length,
      gap_analysis_error: (e as Error).message,
    }, { status: 207 });
  }

  // Send email alerts for HIGH severity gaps
  const highGaps = gapResult.gaps.filter((g) => g.severity === "HIGH");
  if (highGaps.length > 0) {
    await sendGapAlert({
      tourName: tour.name,
      venueName: venue.venue_name,
      city: venue.city,
      highGapCount: highGaps.length,
      gapSummary: gapResult.summary,
      uploadedBy: session.user.email!,
    }).catch((e) => console.error("Gap alert email failed:", e));
  }

  return NextResponse.json({
    packet_id: packet.id,
    extracted_count: extraction.specs.length,
    gap_summary: gapResult.summary,
  }, { status: 201 });
}
