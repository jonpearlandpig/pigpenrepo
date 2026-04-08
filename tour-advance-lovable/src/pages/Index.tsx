// Dashboard — urgency-first view of all upcoming shows
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Plus, Music2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Layout } from "@/components/Layout";
import { VenueCard, type VenueCardData } from "@/components/VenueCard";
import { daysUntil } from "@/lib/utils";

interface Tour {
  id: string;
  name: string;
  artist: string;
  season: string | null;
  akb_locked: boolean;
}

interface VenueWithTour extends VenueCardData {
  tour_id: string;
  tour_name: string;
  tour_artist: string;
}

export default function Index() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueWithTour[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTour, setShowNewTour] = useState(false);
  const [form, setForm] = useState({ name: "", artist: "", season: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      // Load venues with gap summary for the dashboard
      const { data: tourData } = await supabase.from("tours").select("*").order("created_at", { ascending: false });
      setTours(tourData ?? []);

      const { data: venueData } = await supabase
        .from("venues")
        .select(`
          id, venue_name, city, state_province, show_date, advance_call_date, tour_id,
          gap_reports(severity, resolved, status),
          tech_packets(id, processed)
        `)
        .order("show_date", { ascending: true });

      if (venueData && tourData) {
        const tourMap = Object.fromEntries(tourData.map((t) => [t.id, t]));
        const enriched = venueData
          .map((v) => ({
            ...v,
            tour_name: tourMap[v.tour_id]?.name ?? "Unknown Tour",
            tour_artist: tourMap[v.tour_id]?.artist ?? "",
          }))
          .filter((v) => daysUntil(v.show_date) >= 0) // hide past shows by default
          .sort((a, b) => {
            // Sort by urgency: (HIGH open gaps) × (days until show proximity)
            const urgA = (a.gap_reports?.filter((g: { severity: string; resolved: boolean }) => g.severity === "HIGH" && !g.resolved).length ?? 0);
            const urgB = (b.gap_reports?.filter((g: { severity: string; resolved: boolean }) => g.severity === "HIGH" && !g.resolved).length ?? 0);
            const dA = daysUntil(a.show_date);
            const dB = daysUntil(b.show_date);
            // Weight: sooner shows with more HIGH gaps come first
            return (urgA * (1 / Math.max(dA, 1))) > (urgB * (1 / Math.max(dB, 1))) ? -1 : dA - dB;
          });
        setVenues(enriched as VenueWithTour[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function createTour(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data } = await supabase.from("tours").insert({ name: form.name, artist: form.artist, season: form.season || null }).select().single();
    if (data) { setTours((prev) => [data, ...prev]); navigate(`/tours/${data.id}`); }
    setSaving(false);
  }

  // Split into urgent (HIGH gaps + show < 14 days) and regular
  const urgentVenues = venues.filter(
    (v) => daysUntil(v.show_date) <= 14 && (v.gap_reports?.some((g: { severity: string; resolved: boolean }) => g.severity === "HIGH" && !g.resolved))
  );
  const regularVenues = venues.filter((v) => !urgentVenues.includes(v));

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-zinc-600">
          <Loader2 size={24} className="animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Hero */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Your Shows</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {venues.length} upcoming · sorted by urgency
            </p>
          </div>
          <button
            onClick={() => setShowNewTour((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm rounded-lg transition-colors"
          >
            <Plus size={15} /> New Tour
          </button>
        </div>

        {/* New tour form */}
        {showNewTour && (
          <form onSubmit={createTour} className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-8">
            <h3 className="font-semibold text-zinc-200 text-sm mb-4">Create Tour</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Artist *</label>
                <input required value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="Artist name" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Tour Name *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="World Tour 2025" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Season</label>
                <input value={form.season} onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="Spring 2025" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors">
                {saving ? "Creating..." : "Create Tour"}
              </button>
              <button type="button" onClick={() => setShowNewTour(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Urgent section */}
        {urgentVenues.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-red-400" />
              <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider">Needs Attention Now</h2>
              <span className="text-xs text-zinc-600">Show in &lt;14 days with open HIGH gaps</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {urgentVenues.map((v) => (
                <div key={v.id}>
                  <div className="text-[10px] text-zinc-600 mb-1 truncate">{v.tour_artist} — {v.tour_name}</div>
                  <VenueCard venue={v} tourId={v.tour_id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All upcoming shows — grouped by tour */}
        {regularVenues.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Upcoming Shows</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {regularVenues.map((v) => (
                <div key={v.id}>
                  <div className="text-[10px] text-zinc-600 mb-1 truncate">{v.tour_artist} — {v.tour_name}</div>
                  <VenueCard venue={v} tourId={v.tour_id} />
                </div>
              ))}
            </div>
          </div>
        )}

        {venues.length === 0 && tours.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Music2 size={40} className="text-zinc-700 mb-4" />
            <p className="text-zinc-400 font-medium">No tours yet</p>
            <p className="text-zinc-600 text-sm mt-1">Create a tour to get started</p>
          </div>
        )}

        {/* Tours list (for navigation even if no venues added yet) */}
        {tours.length > 0 && venues.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tours.map((tour) => (
              <div key={tour.id} onClick={() => navigate(`/tours/${tour.id}`)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 cursor-pointer transition-all">
                <p className="font-semibold text-zinc-100">{tour.artist}</p>
                <p className="text-zinc-500 text-sm">{tour.name}</p>
                <p className="text-zinc-600 text-xs mt-2">No venues added yet</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
