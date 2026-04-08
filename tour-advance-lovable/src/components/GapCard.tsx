import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Copy, AlertTriangle, Zap, HelpCircle } from "lucide-react";

export interface GapItem {
  id: string;
  category: string;
  status: "MATCH" | "EXCEEDS" | "SHORTFALL" | "MISSING" | "UNCLEAR" | "CONFLICT";
  severity: "HIGH" | "MEDIUM" | "LOW";
  akb_key: string;
  akb_value: string | null;
  venue_value: string | null;
  description: string;
  suggested_action: string | null;
  resolved: boolean;
  resolved_notes: string | null;
}

interface GapCardProps {
  gap: GapItem;
  onResolve: (id: string, notes: string) => Promise<void>;
  onAddToAgenda?: (gap: GapItem) => void;
}

const STATUS_CONFIG = {
  MATCH:     { label: "Match",     cls: "bg-green-900/40 text-green-400 border-green-800/50" },
  EXCEEDS:   { label: "Exceeds",   cls: "bg-blue-900/40 text-blue-400 border-blue-800/50" },
  SHORTFALL: { label: "Shortfall", cls: "bg-orange-900/40 text-orange-400 border-orange-800/50" },
  MISSING:   { label: "Missing",   cls: "bg-red-900/40 text-red-400 border-red-800/50" },
  UNCLEAR:   { label: "Unclear",   cls: "bg-zinc-800 text-zinc-400 border-zinc-700" },
  CONFLICT:  { label: "Conflict",  cls: "bg-purple-900/40 text-purple-400 border-purple-800/50" },
};

const SEV_ICON = {
  HIGH:   <AlertTriangle size={13} className="text-red-400" />,
  MEDIUM: <Zap size={13} className="text-orange-400" />,
  LOW:    <HelpCircle size={13} className="text-zinc-500" />,
};

const SEV_BORDER = { HIGH: "border-l-red-500", MEDIUM: "border-l-orange-500", LOW: "border-l-zinc-700" };

export function GapCard({ gap, onResolve, onAddToAgenda }: GapCardProps) {
  const [expanded, setExpanded] = useState(gap.severity === "HIGH" && !gap.resolved);
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const statusCfg = STATUS_CONFIG[gap.status];

  async function handleResolve() {
    setLoading(true);
    await onResolve(gap.id, notes);
    setLoading(false);
    setResolving(false);
  }

  return (
    <div
      className={`border-l-4 ${SEV_BORDER[gap.severity]} bg-zinc-900 border border-zinc-800 rounded-lg mb-2 transition-all ${gap.resolved ? "opacity-40" : ""}`}
    >
      {/* Header — always visible */}
      <div
        className="flex items-start gap-3 p-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-shrink-0 mt-0.5">
          {gap.resolved
            ? <CheckCircle2 size={16} className="text-green-500" />
            : SEV_ICON[gap.severity]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{gap.category}</span>
            {gap.resolved && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-900/40 text-green-400 border-green-800/50">
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-zinc-200 truncate">{gap.akb_key}</p>
          {!expanded && (
            <p className="text-xs text-zinc-500 truncate mt-0.5">{gap.description}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-zinc-600">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-800/60">
          <p className="text-sm text-zinc-300 mt-3 mb-3">{gap.description}</p>

          {/* Comparison */}
          {(gap.akb_value || gap.venue_value) && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {gap.akb_value && (
                <div className="bg-zinc-950 rounded p-2.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Rider Requires</p>
                  <p className="text-xs text-zinc-200 font-medium">{gap.akb_value}</p>
                </div>
              )}
              {gap.venue_value && (
                <div className="bg-zinc-950 rounded p-2.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Venue Provides</p>
                  <p className="text-xs text-zinc-200 font-medium">{gap.venue_value}</p>
                </div>
              )}
              {!gap.venue_value && gap.status === "MISSING" && (
                <div className="bg-red-950/20 border border-red-900/30 rounded p-2.5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Venue Provides</p>
                  <p className="text-xs text-red-400 italic">Not mentioned in tech packet</p>
                </div>
              )}
            </div>
          )}

          {/* Suggested action */}
          {gap.suggested_action && !gap.resolved && (
            <div className="flex items-start gap-2 bg-amber-950/20 border border-amber-900/30 rounded px-3 py-2 mb-3">
              <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
              <p className="text-xs text-amber-200">{gap.suggested_action}</p>
            </div>
          )}

          {gap.resolved && gap.resolved_notes && (
            <div className="bg-green-950/20 border border-green-900/30 rounded px-3 py-2 mb-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Resolution notes</p>
              <p className="text-xs text-green-200">{gap.resolved_notes}</p>
            </div>
          )}

          {/* Actions */}
          {!gap.resolved && (
            <div className="flex flex-wrap gap-2">
              {!resolving ? (
                <>
                  <button
                    onClick={() => setResolving(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs rounded transition-colors"
                  >
                    <Circle size={12} /> Mark resolved
                  </button>
                  {onAddToAgenda && (
                    <button
                      onClick={() => onAddToAgenda(gap)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs rounded transition-colors"
                    >
                      + Add to advance agenda
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const text = `${gap.akb_key}\nRider requires: ${gap.akb_value ?? "—"}\nVenue: ${gap.venue_value ?? "Not provided"}\nAction: ${gap.suggested_action ?? "—"}`;
                      navigator.clipboard.writeText(text);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs rounded transition-colors"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </>
              ) : (
                <div className="w-full">
                  <textarea
                    autoFocus
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How was this resolved? (optional)"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none mb-2"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleResolve}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs rounded transition-colors font-medium"
                    >
                      <CheckCircle2 size={12} /> {loading ? "Saving..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setResolving(false)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 text-xs rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
