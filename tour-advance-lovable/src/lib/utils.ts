import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function daysUntil(dateStr: string): number {
  return differenceInCalendarDays(parseISO(dateStr), new Date());
}

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), "EEE, MMM d yyyy");
}

export function urgencyFromDays(days: number): "critical" | "warning" | "ok" | "past" {
  if (days < 0) return "past";
  if (days <= 3) return "critical";
  if (days <= 10) return "warning";
  return "ok";
}

export function healthScore(gaps: Array<{ severity: string; resolved: boolean }>): number {
  if (!gaps.length) return 100;
  const open = gaps.filter((g) => !g.resolved);
  if (!open.length) return 100;
  // Weight: HIGH=10pts, MEDIUM=4pts, LOW=1pt
  const maxPoints = gaps.reduce((s, g) => s + (g.severity === "HIGH" ? 10 : g.severity === "MEDIUM" ? 4 : 1), 0);
  const lostPoints = open.reduce((s, g) => s + (g.severity === "HIGH" ? 10 : g.severity === "MEDIUM" ? 4 : 1), 0);
  return Math.max(0, Math.round(((maxPoints - lostPoints) / maxPoints) * 100));
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const DEPT_CONTACTS: Record<string, string> = {
  POWER: "Head Electrician",
  RIGGING: "Head Rigger",
  AUDIO: "House Audio Engineer",
  LIGHTING: "Lighting Director",
  VIDEO: "Video Director",
  STAGING: "Production Manager",
  BACKLINE: "Backline Tech",
  CATERING: "Catering Manager",
  HOSPITALITY: "Venue Coordinator",
  LOGISTICS: "Production Manager",
  PYRO: "Special Effects Supervisor",
  EFFECTS: "Special Effects Supervisor",
  GENERAL: "Production Manager",
  CONTACTS: "Production Manager",
};

export function deptContact(category: string): string {
  return DEPT_CONTACTS[category] ?? "Production Manager";
}
