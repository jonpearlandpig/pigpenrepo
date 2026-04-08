// The heart of TAPS — gap report + advance call checklist side-by-side
import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Loader2, Phone, Filter,
  FileText, Printer, ArrowLeft
} from "lucide-react";
import { supabase, API_BASE } from "@/lib/supabase";
import { Layout } from "@/components/Layout";
import { GapCard, type GapItem } from "@/components/GapCard";
import { AdvanceChecklist, type ChecklistGap, type VenueContactInfo } from "@/components/AdvanceChecklist";
import { CountdownBadge } from "@/components/CountdownBadge";
import { VenueHealthRing } from "@/components/VenueHealthRing";
import { UploadZone } from "@/components/UploadZone";
import { healthScore, formatDate, daysUntil } from "@/lib/utils";

type GapFilter = "ALL" | "OPEN" | "HIGH" | "MISSING" | "CONFLICT" | "RESOLVED";
type ViewMode = "gaps" | "checklist";

interface Venue {
  id: string;
  venue_name: string;
  city: string;
  state_province: string | null;
  address: string | null;
  show_date: string;
  load_in_date: string | null;
  advance_call_date: string | null;
  capacity: number | null;
  tour_id: string;
}

interface Tour {
  id: string;
  name: string;
  artist: string;
  akb_locked: boolean;
}

export default function VenueDetail() {
  const { tourId, venueId } = useParams<{ tourId: string; venueId: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [contacts, setContacts] = useState<VenueContactInfo[]>([]);
  const [hasPacket, setHasPacket] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GapFilter>("OPEN");
  const [catFilter, setCatFilter] = useState<string>("ALL");
  const [view, setView] = useState<ViewMode>("gaps");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!venueId || !tourId) return;
    async function load() {
      const [{ data: venueData }, { data: tourData }, { data: gapData }, { data: contactData }, { data: packetData }] =
        await Promise.all([
          supabase.from("venues").select("*").eq("id", venueId!).single(),
          supabase.from("tours").select("id, name, artist, akb_locked").eq("id", tourId!).single(),
          supabase.from("gap_reports").select("*").eq("venue_id", venueId!).order("severity"),
          supabase.from("venue_contacts").select("*").eq("venue_id", venueId!),
          supabase.from("tech_packets").select("id, processed").eq("venue_id", venueId!),
        ]);
      setVenue(venueData);
      setTour(tourData);
      setGaps((gapData ?? []) as GapItem[]);
      setContacts(contactData ?? []);
      setHasPacket((packetData ?? []).some((p) => p.processed));
      setLoading(false);
    }
    load();
  }, [venueId, tourId]);

  async function uploadPacket(file: File): Promise<string> {
    if (!tour?.akb_locked) throw new Error("AKB must be locked before uploading tech packets.");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("venue_id", venueId!);
    const res = await fetch(`${API_BASE}/api/venues/packet`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    // Reload gaps
    const { data: gapData } = await supabase.from("gap_reports").select("*").eq("venue_id", venueId!);
    const { data: contactData } = await supabase.from("venue_contacts").select("*").eq("venue_id", venueId!);
    setGaps((gapData ?? []) as GapItem[]);
    setContacts(contactData ?? []);
    setHasPacket(true);
    return `${data.extracted_count} specs extracted · ${data.gap_summary?.total ?? 0} gaps found (${data.gap_summary?.high ?? 0} HIGH)`;
  }

  async function resolveGap(gapId: string, notes: string) {
    const res = await fetch(`${API_BASE}/api/gaps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gap_id: gapId, resolved: true, notes }),
    });
    if (res.ok) {
      setGaps((prev) => prev.map((g) => g.id === gapId ? { ...g, resolved: true, resolved_notes: notes } : g));
    }
  }

  if (loading || !venue || !tour) {
    return <Layout><div className="flex items-center justify-center h-64 text-zinc-600"><Loader2 size={24} className="animate-spin" /></div></Layout>;
  }

  // Gap stats
  const openGaps = gaps.filter((g) => !g.resolved);
  const highOpen = openGaps.filter((g) => g.severity === "HIGH");
  const score = healthScore(gaps.map((g) => ({ severity: g.severity, resolved: g.resolved })));
  const days = daysUntil(venue.show_date);
  const advanceDays = venue.advance_call_date ? daysUntil(venue.advance_call_date) : null;
  const advanceImminent = advanceDays !== null && advanceDays <= 2;

  // Filters
  const cats = ["ALL", ...Array.from(new Set(gaps.map((g) => g.category)))];
  const filteredGaps = gaps.filter((g) => {
    const catMatch = catFilter === "ALL" || g.category === catFilter;
    const statusMatch =
      filter === "ALL" ? true :
      filter === "OPEN" ? !g.resolved :
      filter === "HIGH" ? (g.severity === "HIGH" && !g.resolved) :
      filter === "MISSING" ? g.status === "MISSING" :
      filter === "CONFLICT" ? g.status === "CONFLICT" :
      filter === "RESOLVED" ? g.resolved : true;
    return catMatch && statusMatch;
  });

  // Sort: HIGH unresolved first, then by severity
  const sorted = [...filteredGaps].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (sevOrder[a.severity as keyof typeof sevOrder] ?? 3) - (sevOrder[b.severity as keyof typeof sevOrder] ?? 3);
  });

  const checklistGaps: ChecklistGap[] = openGaps.map((g) => ({
    id: g.id, category: g.category, akb_key: g.akb_key,
    akb_value: g.akb_value, venue_value: g.venue_value,
    status: g.status, severity: g.severity,
    description: g.description, suggested_action: g.suggested_action,
  }));

  function printReport() {
    window.print();
  }

  return (
    <Layout breadcrumbs={[
      { label: "Tours", href: "/tours" },
      { label: `${tour.artist}`, href: `/tours/${tourId}` },
      { label: venue.venue_name }
    ]}>

      {/* Print-only styles */}
      <style>{`@media print { .no-print { display: none !important; } body { background: white; color: black; } }`}</style>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Venue header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <CountdownBadge showDate={venue.show_date} large />
            <div>
              <h1 className="text-xl font-bold text-zinc-100">{venue.venue_name}</h1>
              <p className="text-zinc-400 text-sm">{venue.city}{venue.state_province ? `, ${venue.state_province}` : ""}</p>
              {venue.address && <p className="text-zinc-600 text-xs mt-0.5">{venue.address}</p>}
              <p className="text-zinc-500 text-xs mt-1">{formatDate(venue.show_date)}</p>
              {venue.load_in_date && <p className="text-zinc-600 text-xs">Load in: {formatDate(venue.load_in_date)}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasPacket && <VenueHealthRing score={score} size={72} strokeWidth={6} label="health" />}
            <div className="no-print flex items-center gap-2">
              <button onClick={printReport} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors">
                <Printer size={13} /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Alert: advance call imminent with open HIGH gaps */}
        {advanceImminent && highOpen.length > 0 && (
          <div className="no-print mb-4 p-3 bg-red-950/30 border border-red-800/60 rounded-xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-300">
                Advance call in {advanceDays}d — {highOpen.length} unresolved HIGH issue{highOpen.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5">
                These need to be resolved or flagged before {venue.advance_call_date ? formatDate(venue.advance_call_date) : "the call"}.
              </p>
            </div>
          </div>
        )}

        {/* All clear */}
        {hasPacket && openGaps.length === 0 && (
          <div className="mb-4 p-3 bg-green-950/20 border border-green-800/40 rounded-xl flex items-center gap-3">
            <CheckCircle2 size={18} className="text-green-400" />
            <p className="text-sm text-green-300 font-medium">All gaps resolved — ready for the advance call.</p>
          </div>
        )}

        {/* Gap summary stats */}
        {hasPacket && gaps.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "High", value: highOpen.length, color: highOpen.length > 0 ? "text-red-400" : "text-zinc-600", border: highOpen.length > 0 ? "border-red-900/40" : "border-zinc-800" },
              { label: "Medium", value: openGaps.filter((g) => g.severity === "MEDIUM").length, color: "text-orange-400", border: "border-zinc-800" },
              { label: "Low", value: openGaps.filter((g) => g.severity === "LOW").length, color: "text-zinc-400", border: "border-zinc-800" },
              { label: "Resolved", value: gaps.filter((g) => g.resolved).length, color: "text-green-400", border: "border-zinc-800" },
            ].map((s) => (
              <div key={s.label} className={`bg-zinc-900 border ${s.border} rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* No packet yet — upload zone */}
        {!hasPacket && (
          <div className="mb-6">
            {!tour.akb_locked ? (
              <div className="p-5 bg-zinc-900 border border-zinc-700 rounded-xl text-center">
                <p className="text-zinc-400 text-sm font-medium mb-1">AKB not locked for this tour</p>
                <p className="text-zinc-600 text-xs">Lock the AKB first before uploading a tech packet.</p>
                <button onClick={() => window.history.back()} className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-amber-400 hover:underline">
                  <ArrowLeft size={11} /> Go back and lock AKB
                </button>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
                <h2 className="font-semibold text-zinc-200 text-sm mb-1">Upload Tech Packet</h2>
                <p className="text-zinc-500 text-xs mb-4">
                  Upload {venue.venue_name}'s technical packet. Claude will extract specs and compare to the AKB.
                </p>
                <UploadZone
                  label={`Drop ${venue.venue_name} tech packet`}
                  hint="Venue technical rider, stage plot, or any spec document"
                  onUpload={uploadPacket}
                />
              </div>
            )}
          </div>
        )}

        {/* Main content: tabs (mobile) or side-by-side (desktop) */}
        {hasPacket && (
          <>
            {/* Mobile tab switcher */}
            <div className="flex no-print mb-4 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800 lg:hidden">
              {([["gaps", <Filter size={13} />, "Gap Report"], ["checklist", <Phone size={13} />, "Advance Checklist"]] as const).map(([v, icon, label]) => (
                <button key={v} onClick={() => setView(v as ViewMode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded transition-all ${view === v ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="flex gap-6">

              {/* Gap report column */}
              <div className={`flex-1 min-w-0 ${view === "checklist" ? "hidden lg:block" : ""}`}>
                <div className="no-print flex items-center gap-2 mb-3 flex-wrap">
                  {/* Status filter */}
                  <div className="flex gap-1 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800">
                    {(["OPEN", "HIGH", "MISSING", "CONFLICT", "RESOLVED", "ALL"] as GapFilter[]).map((f) => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-all ${filter === f ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Category filter */}
                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                  >
                    {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <span className="text-zinc-600 text-[10px] ml-auto">{sorted.length} items</span>
                </div>

                {/* Print header */}
                <div className="hidden print:block mb-4">
                  <h2 className="text-lg font-bold">{venue.venue_name} — Gap Report</h2>
                  <p className="text-sm text-gray-600">{tour.artist} · {tour.name} · Show: {formatDate(venue.show_date)}</p>
                  <p className="text-sm text-gray-600">Health: {score}% · Open: {openGaps.length} · Resolved: {gaps.length - openGaps.length}</p>
                </div>

                <div ref={printRef}>
                  {sorted.length === 0 ? (
                    <div className="text-center py-12 text-zinc-600 text-sm">
                      {filter === "OPEN" ? "No open gaps — all resolved!" : "No items match this filter."}
                    </div>
                  ) : (
                    sorted.map((gap) => (
                      <GapCard key={gap.id} gap={gap} onResolve={resolveGap} />
                    ))
                  )}
                </div>
              </div>

              {/* Advance checklist column */}
              <div className={`w-full lg:w-96 flex-shrink-0 ${view === "gaps" ? "hidden lg:block" : ""}`}>
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sticky top-20 no-print">
                  <AdvanceChecklist
                    gaps={checklistGaps}
                    contacts={contacts}
                    venueName={venue.venue_name}
                    advanceCallDate={venue.advance_call_date}
                  />
                </div>
              </div>
            </div>

            {/* Re-upload packet */}
            {hasPacket && tour.akb_locked && (
              <div className="mt-8 no-print">
                <details className="group">
                  <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400 list-none flex items-center gap-1">
                    <FileText size={11} /> Re-upload tech packet (replaces current)
                  </summary>
                  <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <UploadZone
                      label="Drop updated tech packet"
                      hint="This will replace the existing spec extraction and re-run gap analysis."
                      onUpload={uploadPacket}
                    />
                  </div>
                </details>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
