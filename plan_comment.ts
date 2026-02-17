import { route } from "./router.js";
import { postIssueComment } from "./github_api.js";
import type { PigPenPlan } from "./types.js";

const token = process.env.GITHUB_TOKEN!;
const repo = process.env.REPO!;
const issueNumber = Number(process.env.ISSUE_NUMBER!);

const issueTitle = process.env.ISSUE_TITLE ?? "";
const issueBody = process.env.ISSUE_BODY ?? "";
const commentBody = process.env.COMMENT_BODY ?? "";

export function buildPlan(action: any) {
  return route({ action, issueTitle, issueBody, commentBody });
}

export async function postPlan(plan: PigPenPlan) {
  const text =
`PigPenOS Plan (NTL)
TID: ${plan.tid}
TAID: ${plan.taid}
Version: ${plan.version}

Action: ${plan.action}
Intent: ${plan.intent}
Domain: ${plan.domain}
Risk: ${plan.risk}
Two-Key Required: ${plan.twoKeyRequired ? "YES" : "NO"}

Files likely:
- ${plan.filesLikely.join("\n- ")}

Steps:
- ${plan.steps.join("\n- ")}

Tests:
- ${plan.tests.join("\n- ")}

Rollback:
- ${plan.rollback}

NTL Next:
- Reply in plain English with 'implement' / 'open a PR' to execute.
- Or reply with 'plan' / 'breakdown' to refine scope.
`;

  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: "```text\n" + text + "\n```",
  });
}
