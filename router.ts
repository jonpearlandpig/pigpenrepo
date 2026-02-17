import type { PigPenPlan, PigPenRisk, PigPenAction } from "./types.js";

function riskFromText(t: string): PigPenRisk {
  const s = t.toLowerCase();
  if (s.includes("auth") || s.includes("payment") || s.includes("security")) return "high";
  if (s.includes("rate") || s.includes("limit") || s.includes("middleware")) return "medium";
  return "low";
}

export function route(params: {
  action: PigPenAction;
  issueTitle: string;
  issueBody: string;
  commentBody: string;
}): PigPenPlan {
  const text = `${params.issueTitle}\n${params.issueBody ?? ""}\n${params.commentBody ?? ""}`.trim();
  const risk = riskFromText(text);

  const intent = text.toLowerCase().includes("rate limit") ? "add_rate_limiter" : "general_change";

  const domain =
    text.toLowerCase().includes("api") || text.toLowerCase().includes("endpoint") ? "ops" : "projects";

  const filesLikely =
    intent === "add_rate_limiter"
      ? ["src/rateLimiter.ts", "src/index.ts", "test/rateLimiter.test.ts"]
      : ["src/index.ts"];

  const steps =
    intent === "add_rate_limiter"
      ? [
          "Add a rate limiter module with a small, testable surface.",
          "Wire limiter into app entrypoint.",
          "Add unit tests covering limit exceeded behavior.",
          "Run CI (tests) and open PR with summary + rollback note.",
        ]
      : ["Implement minimal change with tests, keep PR small."];

  const tests = intent === "add_rate_limiter" ? ["npm test (unit)"] : ["npm test"];
  const rollback =
    intent === "add_rate_limiter"
      ? "Revert PR; limiter is isolated to rateLimiter.ts + one import."
      : "Revert PR.";

  return {
    tid: "TID-PPOS-0001",
    taid: "TAID-PPOS-PLAN-0004",
    version: "v0.5.0",
    action: params.action,
    intent,
    domain,
    risk,
    filesLikely,
    steps,
    tests,
    rollback,
    twoKeyRequired: false, // set by patch scan in implement.ts
  };
}
