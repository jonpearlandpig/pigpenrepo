// Tour detail: AKB upload/lock + venue list + add venue
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Lock, Unlock, Plus, CheckCircle2, Loader2, MapPin, Calendar } from "lucide-react";
import { supabase, API_BASE } from "@/lib/supabase";
import { Layout } from "@/components/Layout";
import { VenueCard, type VenueCardData } from "@/components/VenueCard";
import { UploadZone } from "@/components/UploadZone";

interface Tour {
  id: string;
  name: string;
  artist: string;
  season: string | null;
  akb_locked: boolean;
  akb_locked_at: string | null;
}

interface AKBStats {
  total: number;
  byCategory: Record<string, number>;
}

export default function TourDetail() {
  const { tourId } = useParams<{ tourId: string }>();
  const navigate = useNavigate();
  const [tour, setTour] = useState<Tour | null>(null);
  const [venues, setVenues] = useState<VenueCardData[]>([]);
  const [akbStats, setAkbStats] = useState<AKBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [locking, setLocking] = useState(false);
  const [venueForm, setVenueForm] = useState({
    venue_name: "", city: "", state_province: "", address: "",
    show_date: "", load_in_date: "", advance_call_date: "", capacity: "",
  });
  const [addingVenue, setAddingVenue] = useState(false);
  const [showAKBPanel, setShowAKBPanel] = useState(false);

  useEffect(() => {
    if (!tourId) return;
    async function load() {
      const [{ data: tourData }, { data: venueData }, { data: akbData }] = await Promise.all([
        supabase.from("tours").select("*").eq("id", tourId).single(),
        supabase.from("venues").select(`
          id, venue_name, city, state_province, show_date, advance_call_date, tour_id,
          gap_reports(severity, resolved, status),
          tech_packets(id, processed)
        `).eq("tour_id", tourId!).order("show_date", { ascending: true }),
        supabase.from("akb_entries").select("category").eq("tour_id", tourId!),
      ]);
      setTour(tourData);
      setVenues(venueData ?? []);
      if (akbData && akbData.length > 0) {
        const byCategory: Record<string, number> = {};
        akbData.forEach((e) => { byCategory[e.category] = (byCategory[e.category] ?? 0) + 1; });
        setAkbStats({ total: akbData.length, byCategory });
      }
      setLoading(false);
    }
    load();
  }, [tourId]);

  async function uploadRider(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("tour_id", tourId!);
    const res = await fetch(`${API_BASE}/api/akb`, { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    // Refresh AKB stats
    const { data: akbData } = await supabase.from("akb_entries").select("category").eq("tour_id", tourId!);
    if (akbData) {
      const byCategory: Record<string, number> = {};
      akbData.forEach((e) => { byCategory[e.category] = (byCategory[e.category] ?? 0) + 1; });
      setAkbStats({ total: akbData.length, byCategory });
    }
    setShowAKBPanel(true);
    return `Extracted ${data.extracted_count} entries — review and lock the AKB.`;
  }

  async function toggleLock() {
    setLocking(true);
    const res = await fetch(`${API_BASE}/api/akb`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_id: tourId, lock: !tour?.akb_locked }),
    });
    const data = await res.json();
    if (res.ok) setTour(data);
    setLocking(false);
  }

  async function addVenue(e: React.FormEvent) {
    e.preventDefault();
    setAddingVenue(true);
    const { data } = await supabase.from("venues").insert({
      tour_id: tourId,
      venue_name: venueForm.venue_name,
      city: venueForm.city,
      state_province: venueForm.state_province || null,
      address: venueForm.address || null,
      show_date: venueForm.show_date,
      load_in_date: venueForm.load_in_date || null,
      advance_call_date: venueForm.advance_call_date || null,
      capacity: venueForm.capacity ? parseInt(venueForm.capacity) : null,
    }).select(`id, venue_name, city, state_province, show_date, advance_call_date, tour_id,
      gap_reports(severity, resolved, status), tech_packets(id, processed)`).single();
    if (data) setVenues((prev) => [...prev, data as VenueCardData].sort((a, b) => a.show_date.localeCompare(b.show_date)));
    setVenueForm({ venue_name: "", city: "", state_province: "", address: "", show_date: "", load_in_date: "", advance_call_date: "", capacity: "" });
    setShowAddVenue(false);
    setAddingVenue(false);
  }

  if (loading || !tour) {
    return <Layout><div className="flex items-center justify-center h-64 text-zinc-600"><Loader2 size={24} className="animate-spin" /></div></Layout>;
  }

  return (
    <Layout breadcrumbs={[{ label: "Tours", href: "/tours" }, { label: `${tour.artist} — ${tour.name}` }]}>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Tour header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{tour.season ?? "Tour"}</p>
            <h1 className="text-2xl font-bold text-zinc-100">{tour.artist}</h1>
            <p className="text-zinc-400 text-sm">{tour.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAKBPanel((v) => !v)}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors"
            >
              {akbStats ? `AKB: ${akbStats.total} entries` : "Upload Rider"}
            </button>
            <button
              onClick={toggleLock}
              disabled={locking || !akbStats}
              className={[
                "flex items-center gap-2 px-4 py-2 font-semibold text-sm rounded-lg transition-colors",
                tour.akb_locked
                  ? "bg-amber-900/30 border border-amber-700/50 text-amber-300 hover:bg-amber-900/50"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700",
                !akbStats ? "opacity-40 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {locking ? <Loader2 size={14} className="animate-spin" /> : tour.akb_locked ? <Lock size={14} /> : <Unlock size={14} />}
              {tour.akb_locked ? "AKB Locked" : "Lock AKB"}
            </button>
          </div>
        </div>

        {/* AKB panel */}
        {showAKBPanel && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-zinc-100 text-sm">Authoritative Knowledge Base (AKB)</h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {tour.akb_locked
                    ? "Locked — this is the source of truth for all venue comparisons."
                    : "Upload your production rider to populate the AKB, then lock it."}
                </p>
              </div>
              {tour.akb_locked && <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />}
            </div>

            {/* AKB category summary */}
            {akbStats && (
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(akbStats.byCategory).map(([cat, count]) => (
                  <span key={cat} className="text-[10px] px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-400">
                    {cat} <span className="text-zinc-200 font-semibold">{count}</span>
                  </span>
                ))}
              </div>
            )}

            {!tour.akb_locked && (
              <UploadZone
                label="Drop production rider here"
                hint="Your official approved rider — PDF or DOCX. Claude will extract all technical requirements."
                onUpload={uploadRider}
              />
            )}

            {tour.akb_locked && (
              <div className="mt-2 p-3 bg-amber-950/20 border border-amber-800/30 rounded-lg text-xs text-amber-200">
                AKB is locked. To make changes, unlock it, re-upload the rider, and re-lock.
                All existing gap reports will be re-run against the new AKB.
              </div>
            )}
          </div>
        )}

        {/* Venue list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-zinc-200 text-sm uppercase tracking-wider">
            Venues · {venues.length} show{venues.length !== 1 ? "s" : ""}
          </h2>
          <button
            onClick={() => setShowAddVenue((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
          >
            <Plus size={13} /> Add Venue
          </button>
        </div>

        {/* Add venue form */}
        {showAddVenue && (
          <form onSubmit={addVenue} className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-4">
            <h3 className="font-semibold text-zinc-200 text-sm mb-4">Add Venue</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Venue Name *</label>
                <input required value={venueForm.venue_name} onChange={(e) => setVenueForm((f) => ({ ...f, venue_name: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="Madison Square Garden" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">City *</label>
                <input required value={venueForm.city} onChange={(e) => setVenueForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="New York" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">State / Province</label>
                <input value={venueForm.state_province} onChange={(e) => setVenueForm((f) => ({ ...f, state_province: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="NY" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Capacity</label>
                <input type="number" value={venueForm.capacity} onChange={(e) => setVenueForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="20000" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block"><Calendar size={9} className="inline mr-1" />Show Date *</label>
                <input required type="date" value={venueForm.show_date} onChange={(e) => setVenueForm((f) => ({ ...f, show_date: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Load-In Date</label>
                <input type="date" value={venueForm.load_in_date} onChange={(e) => setVenueForm((f) => ({ ...f, load_in_date: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block">Advance Call Date</label>
                <input type="date" value={venueForm.advance_call_date} onChange={(e) => setVenueForm((f) => ({ ...f, advance_call_date: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1 block"><MapPin size={9} className="inline mr-1" />Address</label>
                <input value={venueForm.address} onChange={(e) => setVenueForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  placeholder="123 Main St" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={addingVenue}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold text-sm rounded-lg transition-colors">
                {addingVenue ? "Adding..." : "Add Venue"}
              </button>
              <button type="button" onClick={() => setShowAddVenue(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center border-2 border-dashed border-zinc-800 rounded-xl">
            <MapPin size={24} className="text-zinc-700 mb-2" />
            <p className="text-zinc-500 text-sm">No venues yet — add your first show</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {venues.map((v) => <VenueCard key={v.id} venue={v} tourId={tourId!} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
