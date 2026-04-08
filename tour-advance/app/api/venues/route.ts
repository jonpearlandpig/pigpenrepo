import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getServiceClient, uploadFile } from "@/lib/supabase";
import { extractTextFromBuffer, detectFileType, validateExtraction } from "@/lib/parser/document-parser";
import { extractVenueTechPacket } from "@/lib/claude/extraction-client";
import { runGapAnalysis } from "@/lib/compare/gap-analyzer";
import { sendGapAlert } from "@/lib/notify/notifier";
import type { CreateVenueRequest, ApiError } from "@/lib/types";

// GET /api/venues?tour_id=<id> — list venues for a tour
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const tourId = req.nextUrl.searchParams.get("tour_id");
  if (!tourId) return NextResponse.json<ApiError>({ error: "tour_id required" }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from("venues")
    .select(`
      *,
      gap_reports(status, severity),
      tech_packets(id, processed, uploaded_at)
    `)
    .eq("tour_id", tourId)
    .order("show_date", { ascending: true });

  if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/venues — create a new venue for a tour
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data: user } = await db.from("users").select("id, role").eq("email", session.user.email).single();
  if (!user) return NextResponse.json<ApiError>({ error: "User not found" }, { status: 403 });

  let body: CreateVenueRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.tour_id || !body.venue_name || !body.city || !body.show_date) {
    return NextResponse.json<ApiError>({ error: "tour_id, venue_name, city, and show_date are required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("venues")
    .insert({
      tour_id: body.tour_id,
      venue_name: body.venue_name.trim(),
      city: body.city.trim(),
      state_province: body.state_province ?? null,
      country: body.country ?? "US",
      address: body.address ?? null,
      capacity: body.capacity ?? null,
      load_in_date: body.load_in_date ?? null,
      show_date: body.show_date,
      advance_call_date: body.advance_call_date ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
