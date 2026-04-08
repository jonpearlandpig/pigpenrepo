import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getServiceClient } from "@/lib/supabase";
import type { CreateTourRequest, ApiError } from "@/lib/types";

// GET /api/tours — list all tours the user can see
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("tours")
    .select("*, created_by_user:users!created_by(name, email)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/tours — create a new tour
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json<ApiError>({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateTourRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<ApiError>({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.artist?.trim()) {
    return NextResponse.json<ApiError>({ error: "name and artist are required" }, { status: 400 });
  }

  const db = getServiceClient();

  // Resolve the user's ID
  const { data: user } = await db.from("users").select("id").eq("email", session.user.email).single();
  if (!user) {
    return NextResponse.json<ApiError>({ error: "User not found" }, { status: 403 });
  }

  const { data, error } = await db
    .from("tours")
    .insert({ name: body.name.trim(), artist: body.artist.trim(), season: body.season ?? null, created_by: user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json<ApiError>({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
