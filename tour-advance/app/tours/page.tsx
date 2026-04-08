"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Tour } from "@/lib/types";

export default function ToursPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", artist: "", season: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/tours")
      .then((r) => r.json())
      .then((d) => { setTours(d); setLoading(false); });
  }, [status]);

  async function createTour(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setCreating(false); return; }
    setTours((prev) => [data, ...prev]);
    setForm({ name: "", artist: "", season: "" });
    setShowForm(false);
    setCreating(false);
  }

  if (status === "loading" || loading) return <div style={{ padding: 40, color: "var(--muted)" }}>Loading...</div>;

  return (
    <div>
      <nav>
        <span className="logo">TAPS</span>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>{session?.user?.email}</span>
      </nav>

      <div className="container" style={{ paddingTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 style={{ fontSize: 22 }}>Tours</h1>
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ New Tour"}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 15 }}>Create Tour</h3>
            <form onSubmit={createTour}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label>Tour Name *</label>
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="World Tour 2025" />
                </div>
                <div className="form-group">
                  <label>Artist *</label>
                  <input value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} required placeholder="Artist Name" />
                </div>
                <div className="form-group">
                  <label>Season</label>
                  <input value={form.season} onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))} placeholder="Spring 2025" />
                </div>
              </div>
              {error && <p className="error-msg">{error}</p>}
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Tour"}
              </button>
            </form>
          </div>
        )}

        {tours.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
            No tours yet. Create your first tour to get started.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead>
                <tr>
                  <th>Artist / Tour</th>
                  <th>Season</th>
                  <th>AKB Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tours.map((tour) => (
                  <tr key={tour.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/tours/${tour.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tour.artist}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{tour.name}</div>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{tour.season ?? "—"}</td>
                    <td>
                      {tour.akb_locked ? (
                        <span className="badge badge-locked">AKB Locked</span>
                      ) : (
                        <span className="badge" style={{ background: "#1c1917", color: "var(--muted)", border: "1px solid var(--border)" }}>
                          Pending
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>
                      {new Date(tour.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); router.push(`/tours/${tour.id}`); }}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
