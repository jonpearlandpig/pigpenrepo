import { useNavigate } from "react-router-dom";
import { MapPin, Upload, AlertCircle, ChevronRight } from "lucide-react";
import { VenueHealthRing } from "./VenueHealthRing";
import { CountdownBadge } from "./CountdownBadge";
import { formatDate, healthScore, daysUntil } from "@/lib/utils";

export interface VenueCardData {
  id: string;
  venue_name: string;
  city: string;
  state_province: string | null;
  show_date: string;
  advance_call_date: string | null;
  gap_reports: Array<{ severity: string; resolved: boolean; status: string }>;
  tech_packets: Array<{ id: string; processed: boolean }>;
}

interface VenueCardProps {
  venue: VenueCardData;
  tourId: string;
}

export function VenueCard({ venue, tourId }: VenueCardProps) {
  const navigate = useNavigate();
  const score = healthScore(venue.gap_reports ?? []);
  const days = daysUntil(venue.show_date);
  const hasPacket = (venue.tech_packets ?? []).some((p) => p.processed);
  const openHighGaps = (venue.gap_reports ?? []).filter((g) => g.severity === "HIGH" && !g.resolved);
  const openMedGaps = (venue.gap_reports ?? []).filter((g) => g.severity === "MEDIUM" && !g.resolved);
  const totalOpen = (venue.gap_reports ?? []).filter((g) => !g.resolved).length;
  const advanceIn = venue.advance_call_date ? daysUntil(venue.advance_call_date) : null;

  // Urgency: no packet + show soon = highest concern
  const needsAttention = !hasPacket && days <= 14;
  const callImminent = advanceIn !== null && advanceIn <= 2 && openHighGaps.length > 0;

  return (
    <div
      className={[
        "group bg-zinc-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-zinc-600 hover:bg-zinc-800/60",
        callImminent ? "border-red-800/70" : needsAttention ? "border-orange-800/60" : "border-zinc-800",
      ].join(" ")}
      onClick={() => navigate(`/tours/${tourId}/venues/${venue.id}`)}
    >
      {/* Top: countdown + health ring */}
      <div className="flex items-start justify-between mb-3">
        <CountdownBadge showDate={venue.show_date} />
        {hasPacket ? (
          <VenueHealthRing score={score} />
        ) : (
          <div className="w-14 h-14 flex items-center justify-center rounded-full border-2 border-dashed border-zinc-700 text-zinc-600 text-[10px] text-center leading-tight px-1">
            No<br />packet
          </div>
        )}
      </div>

      {/* Venue info */}
      <div className="mb-3">
        <h3 className="font-semibold text-zinc-100 text-sm leading-tight">{venue.venue_name}</h3>
        <div className="flex items-center gap-1 text-zinc-500 text-xs mt-0.5">
          <MapPin size={10} />
          <span>{venue.city}{venue.state_province ? `, ${venue.state_province}` : ""}</span>
        </div>
        <p className="text-zinc-600 text-xs mt-0.5">{formatDate(venue.show_date)}</p>
      </div>

      {/* Status indicators */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {!hasPacket && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Upload size={9} /> No packet
          </span>
        )}
        {callImminent && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800/60 animate-pulse">
            <AlertCircle size={9} /> Call in {advanceIn}d
          </span>
        )}
        {openHighGaps.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/50">
            {openHighGaps.length} HIGH
          </span>
        )}
        {openMedGaps.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-950/60 text-orange-400 border border-orange-800/50">
            {openMedGaps.length} MED
          </span>
        )}
        {totalOpen === 0 && hasPacket && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-950/60 text-green-400 border border-green-800/50">
            All clear
          </span>
        )}
      </div>

      {/* Advance call info */}
      {venue.advance_call_date && (
        <div className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2 mt-1">
          Advance call: {formatDate(venue.advance_call_date)}
          {advanceIn !== null && advanceIn >= 0 && (
            <span className={advanceIn <= 3 ? "text-orange-400 font-semibold ml-1" : "ml-1"}>
              ({advanceIn}d away)
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-end text-zinc-600 group-hover:text-zinc-400 transition-colors">
        <ChevronRight size={14} />
      </div>
    </div>
  );
}
