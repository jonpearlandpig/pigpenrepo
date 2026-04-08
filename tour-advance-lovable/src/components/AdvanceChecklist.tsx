// The "perceptive" core of TAPS.
// Turns raw gap data into an actionable advance call workflow:
// grouped by department, with contact info, specific questions, and call-phase structure.

import { useState } from "react";
import {
  Phone, CheckSquare, Square, ChevronDown, ChevronUp,
  Copy, User, Mail, MessageSquare, Zap, AlertTriangle, CheckCircle2
} from "lucide-react";
import { deptContact } from "@/lib/utils";

export interface ChecklistGap {
  id: string;
  category: string;
  akb_key: string;
  akb_value: string | null;
  venue_value: string | null;
  status: string;
  severity: string;
  description: string;
  suggested_action: string | null;
}

export interface VenueContactInfo {
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface AdvanceChecklistProps {
  gaps: ChecklistGap[];
  contacts: VenueContactInfo[];
  venueName: string;
  advanceCallDate: string | null;
}

type Phase = "pre" | "call" | "post";

const CATEGORY_ORDER = [
  "RIGGING", "POWER", "STAGING", "AUDIO", "LIGHTING", "VIDEO",
  "BACKLINE", "PYRO", "EFFECTS", "LOGISTICS", "CATERING",
  "HOSPITALITY", "CONTACTS", "GENERAL",
];

function groupByCategory(gaps: ChecklistGap[]): Record<string, ChecklistGap[]> {
  const map: Record<string, ChecklistGap[]> = {};
  for (const g of gaps) {
    if (g.status === "MATCH") continue; // matches don't need calls
    if (!map[g.category]) map[g.category] = [];
    map[g.category].push(g);
  }
  // Sort categories by defined order
  const sorted: Record<string, ChecklistGap[]> = {};
  CATEGORY_ORDER.forEach((cat) => { if (map[cat]) sorted[cat] = map[cat]; });
  Object.keys(map).forEach((cat) => { if (!sorted[cat]) sorted[cat] = map[cat]; });
  return sorted;
}

function findContact(contacts: VenueContactInfo[], category: string): VenueContactInfo | null {
  const role = deptContact(category).toLowerCase();
  return contacts.find(
    (c) => c.role?.toLowerCase().includes(role.split(" ")[0]) ||
           role.includes(c.role?.toLowerCase().split(" ")[0] ?? "")
  ) ?? contacts.find((c) => c.role?.toLowerCase().includes("production")) ?? null;
}

function sevIcon(sev: string) {
  if (sev === "HIGH") return <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />;
  if (sev === "MEDIUM") return <Zap size={12} className="text-orange-400 flex-shrink-0" />;
  return null;
}

interface DeptSectionProps {
  category: string;
  gaps: ChecklistGap[];
  contact: VenueContactInfo | null;
  completed: boolean;
  onToggleComplete: () => void;
}

function DeptSection({ category, gaps, contact, completed, onToggleComplete }: DeptSectionProps) {
  const [open, setOpen] = useState(!completed && gaps.some((g) => g.severity === "HIGH"));
  const highCount = gaps.filter((g) => g.severity === "HIGH").length;

  // Build agenda items — specific questions to ask
  const questions = gaps.map((g) => {
    if (g.status === "MISSING") return `Confirm ${g.akb_key.toLowerCase()} — rider requires: ${g.akb_value ?? "see rider"}`;
    if (g.status === "SHORTFALL") return `${g.akb_key}: rider needs ${g.akb_value ?? "—"}, venue shows ${g.venue_value ?? "—"} — confirm or find solution`;
    if (g.status === "CONFLICT") return `CONFLICT on ${g.akb_key}: resolve difference between rider and venue packet`;
    if (g.status === "UNCLEAR") return `Clarify ${g.akb_key} — venue packet is ambiguous`;
    return `Confirm ${g.akb_key}`;
  });

  function copyAgenda() {
    const text = [
      `${category} — ${contact?.name ? contact.name + " | " : ""}${contact?.phone ?? ""}`,
      ...questions.map((q, i) => `  ${i + 1}. ${q}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
  }

  return (
    <div className={`border rounded-lg mb-2 transition-all ${completed ? "border-zinc-800/50 opacity-60" : highCount > 0 ? "border-zinc-700" : "border-zinc-800"}`}>
      {/* Dept header */}
      <div className="flex items-center gap-3 p-3">
        <button onClick={onToggleComplete} className="flex-shrink-0">
          {completed
            ? <CheckSquare size={16} className="text-green-500" />
            : <Square size={16} className="text-zinc-600" />}
        </button>

        <div className="flex-1 cursor-pointer" onClick={() => setOpen((v) => !v)}>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wider ${completed ? "text-zinc-500" : "text-zinc-200"}`}>
              {category}
            </span>
            {highCount > 0 && !completed && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40">
                {highCount} HIGH
              </span>
            )}
            <span className="text-[10px] text-zinc-600">{gaps.length} item{gaps.length !== 1 ? "s" : ""}</span>
          </div>
          {contact && (
            <div className="flex items-center gap-1 text-zinc-600 text-[10px] mt-0.5">
              <User size={9} />
              <span>{contact.name ?? contact.role}</span>
              {contact.phone && <><span>·</span><span>{contact.phone}</span></>}
            </div>
          )}
          {!contact && (
            <p className="text-[10px] text-zinc-600 mt-0.5">Call: {deptContact(category)}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); copyAgenda(); }}
            title="Copy call agenda"
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <Copy size={12} />
          </button>
          <div className="text-zinc-600 cursor-pointer" onClick={() => setOpen((v) => !v)}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {/* Questions */}
      {open && (
        <div className="border-t border-zinc-800/60 px-3 pb-3">
          {/* Contact info */}
          {contact && (
            <div className="flex flex-wrap gap-2 py-2 mb-2 border-b border-zinc-800/40">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-[10px] text-amber-400 hover:underline">
                  <Mail size={10} /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-[10px] text-amber-400 hover:underline">
                  <Phone size={10} /> {contact.phone}
                </a>
              )}
            </div>
          )}

          {/* Agenda items */}
          <ol className="space-y-2 mt-2">
            {gaps.map((gap, i) => (
              <li key={gap.id} className="flex items-start gap-2">
                <span className="text-zinc-600 text-[10px] font-mono mt-0.5 flex-shrink-0 w-4">{i + 1}.</span>
                {sevIcon(gap.severity)}
                <div className="flex-1">
                  <p className="text-xs text-zinc-300">{questions[i]}</p>
                  {gap.suggested_action && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">→ {gap.suggested_action}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Quick action: mark whole dept done */}
          {!completed && (
            <button
              onClick={onToggleComplete}
              className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-green-400 transition-colors"
            >
              <CheckCircle2 size={11} /> Mark {category} complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdvanceChecklist({ gaps, contacts, venueName, advanceCallDate }: AdvanceChecklistProps) {
  const [phase, setPhase] = useState<Phase>("pre");
  const [completedDepts, setCompletedDepts] = useState<Set<string>>(new Set());
  const [preChecks, setPreChecks] = useState<Record<string, boolean>>({});

  const openGaps = gaps.filter((g) => g.status !== "MATCH");
  const grouped = groupByCategory(openGaps);
  const deptCount = Object.keys(grouped).length;
  const doneCount = completedDepts.size;
  const allDone = doneCount >= deptCount && deptCount > 0;

  function toggleDept(cat: string) {
    setCompletedDepts((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const PRE_CHECKS = [
    "Confirm advance call date and time with venue",
    "Identify who from venue is on the call (PM, TD, department heads)",
    "Review all HIGH severity gaps before calling",
    "Have production rider open for reference",
    advanceCallDate ? `Advance call scheduled: ${advanceCallDate}` : "Schedule advance call date with venue",
  ];

  const POST_CHECKS = [
    "Update resolved gaps in TAPS",
    "Note any items requiring follow-up",
    "Confirm any amended specs in writing via email",
    "Schedule secondary call if HIGH items remain unresolved",
    "Share gap report summary with Tour Manager and department heads",
  ];

  // Copy full agenda for all departments
  function copyFullAgenda() {
    const lines = [`ADVANCE CALL AGENDA — ${venueName}`, ""];
    Object.entries(grouped).forEach(([cat, catGaps]) => {
      const contact = findContact(contacts, cat);
      lines.push(`## ${cat}${contact?.name ? ` — ${contact.name}` : ""}${contact?.phone ? ` | ${contact.phone}` : ""}`);
      catGaps.forEach((g, i) => {
        const q = g.status === "MISSING"
          ? `Confirm ${g.akb_key}: rider requires ${g.akb_value ?? "see rider"}`
          : g.status === "SHORTFALL"
          ? `${g.akb_key}: need ${g.akb_value}, venue has ${g.venue_value} — resolve`
          : `Clarify ${g.akb_key}`;
        lines.push(`  ${i + 1}. [${g.severity}] ${q}`);
      });
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold text-zinc-100 text-base">Advance Call Checklist</h2>
          {deptCount > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {doneCount}/{deptCount} departments complete
              {allDone && <span className="text-green-400 font-medium ml-2">— Ready for the call!</span>}
            </p>
          )}
        </div>
        <button
          onClick={copyFullAgenda}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
        >
          <Copy size={12} /> Copy agenda
        </button>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800">
        {(["pre", "call", "post"] as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={[
              "flex-1 py-1.5 text-xs font-medium rounded transition-all",
              phase === p ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {p === "pre" ? "Before Call" : p === "call" ? "On The Call" : "After Call"}
          </button>
        ))}
      </div>

      {/* Phase: Before call */}
      {phase === "pre" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 mb-3">Complete these before dialing.</p>
          {PRE_CHECKS.map((item, i) => (
            <label key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-0.5 accent-amber-500 flex-shrink-0"
                checked={!!preChecks[`pre-${i}`]}
                onChange={() => setPreChecks((p) => ({ ...p, [`pre-${i}`]: !p[`pre-${i}`] }))}
              />
              <span className={`text-sm ${preChecks[`pre-${i}`] ? "line-through text-zinc-600" : "text-zinc-300"}`}>
                {item}
              </span>
            </label>
          ))}

          {openGaps.filter((g) => g.severity === "HIGH").length > 0 && (
            <div className="mt-4 p-3 bg-red-950/20 border border-red-900/40 rounded-lg">
              <p className="text-xs font-semibold text-red-400 mb-2">
                {openGaps.filter((g) => g.severity === "HIGH").length} HIGH severity items need attention on this call
              </p>
              {openGaps.filter((g) => g.severity === "HIGH").map((g) => (
                <p key={g.id} className="text-xs text-zinc-400 flex items-start gap-1.5 mt-1">
                  <AlertTriangle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                  {g.akb_key}: {g.description}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={() => setPhase("call")}
            className="mt-4 w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            Ready to call →
          </button>
        </div>
      )}

      {/* Phase: On the call */}
      {phase === "call" && (
        <div>
          {deptCount === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No open gaps to discuss — all items match the rider.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-zinc-500">Work through each department. Check off as you go.</p>
                <div className="text-xs text-zinc-600">
                  {doneCount}/{deptCount} done
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-4">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${deptCount > 0 ? (doneCount / deptCount) * 100 : 0}%` }}
                />
              </div>

              {Object.entries(grouped).map(([cat, catGaps]) => (
                <DeptSection
                  key={cat}
                  category={cat}
                  gaps={catGaps}
                  contact={findContact(contacts, cat)}
                  completed={completedDepts.has(cat)}
                  onToggleComplete={() => toggleDept(cat)}
                />
              ))}

              {allDone && (
                <div className="mt-4 p-3 bg-green-950/20 border border-green-800/40 rounded-lg text-center">
                  <CheckCircle2 size={20} className="text-green-400 mx-auto mb-1" />
                  <p className="text-sm font-semibold text-green-300">All departments covered</p>
                  <button
                    onClick={() => setPhase("post")}
                    className="mt-2 px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
                  >
                    Continue to wrap-up →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Phase: After call */}
      {phase === "post" && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 mb-3">Wrap up after the call ends.</p>
          {POST_CHECKS.map((item, i) => (
            <label key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-green-500 flex-shrink-0"
                checked={!!preChecks[`post-${i}`]}
                onChange={() => setPreChecks((p) => ({ ...p, [`post-${i}`]: !p[`post-${i}`] }))}
              />
              <span className={`text-sm ${preChecks[`post-${i}`] ? "line-through text-zinc-600" : "text-zinc-300"}`}>
                {item}
              </span>
            </label>
          ))}

          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <p className="text-xs text-zinc-500 mb-2">Add notes from the call</p>
            <textarea
              className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-none"
              rows={4}
              placeholder="Key decisions, follow-up items, contacts to reach again..."
            />
            <button className="mt-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs rounded transition-colors">
              <MessageSquare size={11} className="inline mr-1" />
              Save notes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
