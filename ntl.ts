import type { PigPenAction } from "./types.js";

export function inferActionFromNTL(commentBody: string): PigPenAction {
  const t = (commentBody || "").toLowerCase();

  const implementHints = ["implement", "build", "code", "make the change", "open a pr", "ship", "create pr"];
  if (implementHints.some((h) => t.includes(h))) return "IMPLEMENT";

  const planHints = ["plan", "scope", "breakdown", "steps", "how would you do this", "approach"];
  if (planHints.some((h) => t.includes(h))) return "PLAN";

  const fixHints = ["fix ci", "tests failing", "lint", "typecheck", "failing pipeline"];
  if (fixHints.some((h) => t.includes(h))) return "FIX_CI";

  return "UNKNOWN";
}
