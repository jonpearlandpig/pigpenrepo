// GET /api/gaps?venue_id=<id> — fetch gap report for a venue
// PATCH /api/gaps — mark a gap as resolved
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getServiceClient } from "@/lib/supabase";
import type { ApiError } from "@/lib/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const venueId = req.nextUrl.searchParams.get("venue_id");
  if (!venueId) return NextResponse.json<ApiError>({ error: "venue_id required" }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from("gap_reports")
    .select("*")
    .eq("venue_id", venueId)
    .order("severity", { ascending: true })  // HIGH first (alphabetical: H < L < M)
    .order("category", { ascending: true });

  if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });

  // Sort: HIGH > MEDIUM > LOW
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = (data ?? []).sort(
    (a, b) => (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) - (severityOrder[b.severity as keyof typeof severityOrder] ?? 3)
  );

  return NextResponse.json(sorted);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data: user } = await db.from("users").select("id").eq("email", session.user.email).single();
  if (!user) return NextResponse.json<ApiError>({ error: "User not found" }, { status: 403 });

  const { gap_id, resolved, notes } = await req.json();
  if (!gap_id) return NextResponse.json<ApiError>({ error: "gap_id required" }, { status: 400 });

  const { data, error } = await db
    .from("gap_reports")
    .update({
      resolved: resolved !== false,
      resolved_by: user.id,
      resolved_notes: notes ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", gap_id)
    .select()
    .single();

  if (error) return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
