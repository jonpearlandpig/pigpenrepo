"use client";
import { useState } from "react";
import type { GapReport, GapStatus, GapSeverity } from "@/lib/types";

const STATUS_LABELS: Record<GapStatus, string> = {
  MATCH: "Match",
  EXCEEDS: "Exceeds",
  SHORTFALL: "Shortfall",
  MISSING: "Missing",
  UNCLEAR: "Unclear",
  CONFLICT: "Conflict",
};

const SEVERITY_CLASS: Record<GapSeverity, string> = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

interface GapReportProps {
  gaps: GapReport[];
  onResolve?: (gapId: string, notes: string) => Promise<void>;
}

export function GapReportView({ gaps, onResolve }: GapReportProps) {
  const [filter, setFilter] = useState<GapStatus | "ALL" | "UNRESOLVED">("UNRESOLVED");
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const summary = {
    high: gaps.filter((g) => g.severity === "HIGH" && !g.resolved).length,
    medium: gaps.filter((g) => g.severity === "MEDIUM" && !g.resolved).length,
    low: gaps.filter((g) => g.severity === "LOW" && !g.resolved).length,
    total: gaps.length,
    resolved: gaps.filter((g) => g.resolved).length,
  };

  const filtered = gaps.filter((g) => {
    if (filter === "UNRESOLVED") return !g.resolved;
    if (filter === "ALL") return true;
    return g.status === filter;
  });

  async function resolve(gapId: string) {
    if (!onResolve) return;
    setResolving(gapId);
    await onResolve(gapId, notes);
    setResolving(null);
    setNotes("");
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="stats-row" style={{ marginBottom: 20 }}>
        {summary.high > 0 && (
          <div className="stat" style={{ borderColor: "var(--danger)" }}>
            <div className="stat-value" style={{ color: "var(--danger)" }}>{summary.high}</div>
            <div className="stat-label">High Severity</div>
          </div>
        )}
        {summary.medium > 0 && (
          <div className="stat" style={{ borderColor: "var(--warning)" }}>
            <div className="stat-value" style={{ color: "var(--warning)" }}>{summary.medium}</div>
            <div className="stat-label">Medium Severity</div>
          </div>
        )}
        <div className="stat">
          <div className="stat-value" style={{ color: "var(--ok)" }}>{summary.resolved}</div>
          <div className="stat-label">Resolved</div>
        </div>
        <div className="stat">
          <div className="stat-value">{summary.total}</div>
          <div className="stat-label">Total Items</div>
        </div>
      </div>

      {/* HIGH severity alert */}
      {summary.high > 0 && (
        <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 16 }}>
          <strong style={{ color: "var(--danger)" }}>
            {summary.high} show-stopping issue{summary.high !== 1 ? "s" : ""} must be resolved before the advance call.
          </strong>
        </div>
      )}

      {/* Filter tabs */}
      <div className="tag-row" style={{ marginBottom: 16 }}>
        {(["UNRESOLVED", "ALL", "MISSING", "CONFLICT", "SHORTFALL", "UNCLEAR", "MATCH"] as const).map((f) => (
          <button
            key={f}
            className="btn btn-ghost"
            style={{ padding: "4px 12px", fontSize: 12, background: filter === f ? "var(--border)" : undefined }}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? `All (${gaps.length})` : f === "UNRESOLVED" ? `Open (${gaps.filter(g => !g.resolved).length})` : STATUS_LABELS[f as GapStatus]}
          </button>
        ))}
      </div>

      {/* Gap list */}
      {filtered.length === 0 ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: 32 }}>
          {filter === "UNRESOLVED" ? "All gaps resolved!" : "No items in this category."}
        </div>
      ) : (
        filtered.map((gap) => (
          <div key={gap.id} className={`gap-item ${SEVERITY_CLASS[gap.severity as GapSeverity]}${gap.resolved ? " resolved" : ""}`}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="tag-row" style={{ marginBottom: 6 }}>
                  <span className={`badge badge-${gap.severity.toLowerCase()}`}>{gap.severity}</span>
                  <span className={`badge badge-${gap.status.toLowerCase()}`}>{STATUS_LABELS[gap.status as GapStatus]}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{gap.category}</span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{gap.akb_key}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{gap.description}</div>

                {(gap.akb_value || gap.venue_value) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    {gap.akb_value && (
                      <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Rider Requires</div>
                        <div style={{ fontSize: 12 }}>{gap.akb_value}</div>
                      </div>
                    )}
                    {gap.venue_value && (
                      <div style={{ background: "var(--bg)", borderRadius: "var(--radius)", padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Venue Provides</div>
                        <div style={{ fontSize: 12 }}>{gap.venue_value}</div>
                      </div>
                    )}
                  </div>
                )}

                {gap.suggested_action && (
                  <div style={{ fontSize: 12, color: "var(--accent)", background: "#1c1400", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                    Action: {gap.suggested_action}
                  </div>
                )}
              </div>

              {onResolve && !gap.resolved && (
                <div>
                  {resolving === gap.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 200 }}>
                      <textarea
                        placeholder="Resolution notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        style={{ height: 60, resize: "none" }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-primary" style={{ flex: 1, fontSize: 11 }} onClick={() => resolve(gap.id)}>
                          Confirm
                        </button>
                        <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setResolving(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setResolving(gap.id)}>
                      Mark Resolved
                    </button>
                  )}
                </div>
              )}

              {gap.resolved && (
                <span className="badge badge-match">Resolved</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
