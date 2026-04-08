// Gap analyzer: orchestrates the full comparison pipeline for a venue.
// Pulls AKB entries and venue specs from DB, calls Claude, writes gap reports.

import { getServiceClient } from "@/lib/supabase";
import { analyzeGaps } from "@/lib/claude/extraction-client";
import type { AKBEntry, VenueSpec, GapItem, GapAnalysisResult, GapStatus, GapSeverity, AKBCategory } from "@/lib/types";

export async function runGapAnalysis(
  venueId: string,
  packetId: string,
  tourId: string
): Promise<GapAnalysisResult> {
  const db = getServiceClient();

  // Load AKB entries for this tour
  const { data: akbEntries, error: akbErr } = await db
    .from("akb_entries")
    .select("*")
    .eq("tour_id", tourId);

  if (akbErr) throw new Error(`Failed to load AKB entries: ${akbErr.message}`);
  if (!akbEntries || akbEntries.length === 0) {
    throw new Error("No AKB entries found. Lock the AKB before running gap analysis.");
  }

  // Load venue specs for this packet
  const { data: venueSpecs, error: specErr } = await db
    .from("venue_specs")
    .select("*")
    .eq("packet_id", packetId);

  if (specErr) throw new Error(`Failed to load venue specs: ${specErr.message}`);

  // Load venue and tour info for context
  const { data: venue } = await db.from("venues").select("venue_name, city").eq("id", venueId).single();
  const { data: tour } = await db.from("tours").select("name, artist").eq("id", tourId).single();

  const venueName = venue ? `${venue.venue_name}, ${venue.city}` : "Unknown Venue";
  const tourName = tour ? `${tour.artist} — ${tour.name}` : "Unknown Tour";

  // Ask Claude to compare
  const gaps = await analyzeGaps(
    akbEntries as AKBEntry[],
    venueSpecs as VenueSpec[],
    venueName,
    tourName
  );

  // Enrich gaps with IDs by matching back to DB rows
  const enrichedGaps = enrichGapsWithIds(gaps, akbEntries as AKBEntry[], venueSpecs as VenueSpec[]);

  // Persist gap reports to DB (replace previous run for this packet)
  await db.from("gap_reports").delete().eq("packet_id", packetId);

  if (enrichedGaps.length > 0) {
    const rows = enrichedGaps.map((gap) => ({
      venue_id: venueId,
      packet_id: packetId,
      category: gap.category,
      status: gap.status,
      severity: gap.severity,
      akb_entry_id: gap.akb_entry_id ?? null,
      venue_spec_id: gap.venue_spec_id ?? null,
      akb_key: gap.akb_key,
      akb_value: gap.akb_value ?? null,
      venue_value: gap.venue_value ?? null,
      description: gap.description,
      suggested_action: gap.suggested_action ?? null,
    }));

    const { error: insertErr } = await db.from("gap_reports").insert(rows);
    if (insertErr) throw new Error(`Failed to save gap reports: ${insertErr.message}`);
  }

  return buildSummary(venueId, packetId, enrichedGaps);
}

function enrichGapsWithIds(
  gaps: GapItem[],
  akbEntries: AKBEntry[],
  venueSpecs: VenueSpec[]
): GapItem[] {
  return gaps.map((gap) => {
    const akbEntry = akbEntries.find(
      (e) => e.category === gap.category && e.key.toLowerCase() === gap.akb_key.toLowerCase()
    );
    const venueSpec = venueSpecs.find(
      (s) => s.category === gap.category && s.key.toLowerCase() === gap.akb_key.toLowerCase()
    );
    return {
      ...gap,
      akb_entry_id: akbEntry?.id,
      venue_spec_id: venueSpec?.id,
    };
  });
}

function buildSummary(venueId: string, packetId: string, gaps: GapItem[]): GapAnalysisResult {
  const byStatus = {} as Record<GapStatus, number>;
  const byCategory = {} as Record<string, number>;
  let high = 0, medium = 0, low = 0;

  for (const gap of gaps) {
    byStatus[gap.status] = (byStatus[gap.status] ?? 0) + 1;
    byCategory[gap.category] = (byCategory[gap.category] ?? 0) + 1;
    if (gap.severity === "HIGH") high++;
    else if (gap.severity === "MEDIUM") medium++;
    else low++;
  }

  return {
    venue_id: venueId,
    packet_id: packetId,
    gaps,
    summary: {
      total: gaps.length,
      high,
      medium,
      low,
      by_status: byStatus,
      by_category: byCategory,
    },
  };
}
