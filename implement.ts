/**
 * PigPenOS Implement Runner (NTL)
 * TID: TID-PPOS-0001
 * TAID: TAID-PPOS-RUNNER-0002
 * Version: v0.5.0
 * TAI-D: TAI-D-PPOS-0006 (Move branch creation after patch validation)
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { inferActionFromNTL } from "./ntl.js";
import { buildPlan, postPlan } from "./plan_comment.js";
import { extractTouchedPathsFromPatch, getProtectedPrefixes, isProtectedPath } from "./patch_scan.js";
import { createPullRequest, getUserPermission, postIssueComment } from "./github_api.js";
import { healthCheck, requestPatchV1 } from "./llm_adapter.js";
import { applyPatch } from "./apply_patch.js";

const token = process.env.GITHUB_TOKEN!;
const repo = process.env.REPO!;
const issueNumber = Number(process.env.ISSUE_NUMBER!);

const issueTitle = process.env.ISSUE_TITLE ?? "";
const issueBody = process.env.ISSUE_BODY ?? "";
const commentBody = process.env.COMMENT_BODY ?? "";
const actor = process.env.ACTOR ?? "";

const base = process.env.DEFAULT_BASE_BRANCH || "main";

const action = inferActionFromNTL(commentBody);
const plan = buildPlan(action);

// Always post PLAN first
await postPlan(plan);

if (action !== "IMPLEMENT") process.exit(0);

// Actor permission gate (write/maintain/admin)
try {
  const perm = await getUserPermission({ token, repo, username: actor });
  const ok = perm === "write" || perm === "maintain" || perm === "admin";
  if (!ok) {
    await postIssueComment({
      token,
      repo,
      issueNumber,
      body: `PigPenOS Refusal\n\nIMPLEMENT refused: @${actor} permission is '${perm}'. Required: write/maintain/admin.\n\nTAID: TAID-PPOS-REFUSAL-0005\nVersion: v0.5.0`,
    });
    process.exit(0);
  }
} catch (e: any) {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Refusal\n\nIMPLEMENT refused: unable to verify actor permission for @${actor}.\nReason: ${String(e?.message || e)}\n\nTAID: TAID-PPOS-REFUSAL-0006\nVersion: v0.5.0`,
  });
  process.exit(0);
}

// Prepare forbidden paths + plan context
const protectedPrefixes = getProtectedPrefixes();
const forbiddenPaths = protectedPrefixes;

// Patch service health check (early refusal, no branching)
try {
  await healthCheck();
} catch (e: any) {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Refusal\n\nIMPLEMENT refused: patch service health check failed.\nReason: ${String(e?.message || e)}\n\nTAID: TAID-PPOS-REFUSAL-0007\nVersion: v0.5.0`,
  });
  process.exit(0);
}

// Request patch (still no branch)
const contextFiles = plan.filesLikely.map((p) => ({ path: p, content: safeRead(p) }));

let patchOk: any;
try {
  const r = await requestPatchV1({
    tid: plan.tid,
    taid: plan.taid,
    version: "v0.5.0",
    repo,
    issueNumber,
    baseBranch: base,
    issueTitle,
    issueBody,
    commentBody,
    forbiddenPaths,
    contextFiles,
    mustIncludeTests: true,
    maxFiles: 10,
    maxDiffLines: 400,
  });

  patchOk = r;
} catch (e: any) {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Refusal\n\nIMPLEMENT refused: patch request failed.\nReason: ${String(e?.message || e)}\n\nTAID: TAID-PPOS-REFUSAL-0008\nVersion: v0.5.0`,
  });
  process.exit(0);
}

// Validate patch service signals (secondary safety)
if (!patchOk.validation?.tests_included) {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Refusal\n\nIMPLEMENT refused: patch service indicates tests were not included.\n\nTAID: TAID-PPOS-REFUSAL-0009\nVersion: v0.5.0`,
  });
  process.exit(0);
}
if (patchOk.validation?.forbidden_paths_touched) {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Refusal\n\nIMPLEMENT refused: patch service indicates forbidden paths touched.\n\nTAID: TAID-PPOS-REFUSAL-0010\nVersion: v0.5.0`,
  });
  process.exit(0);
}

// Mechanical truth: scan actual patch paths
const touched = extractTouchedPathsFromPatch(patchOk.patch);
const protectedTouched = touched.filter((p: string) => isProtectedPath(p, protectedPrefixes));

if (protectedTouched.length) {
  plan.twoKeyRequired = true;
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body:
`PigPenOS Refusal\n\nIMPLEMENT refused: protected paths detected in patch.\n\nProtected paths touched:\n- ${protectedTouched.join("\n- ")}\n\nTwo-Key Required: YES\n\nTAID: TAID-PPOS-REFUSAL-0011\nVersion: v0.5.0`,
  });
  process.exit(0);
}

// Now create branch only after patch validated
const branch = `pigpen/issue-${issueNumber}`;
execSync(`git checkout -b ${branch}`, { stdio: "inherit" });
execSync(`git remote set-url origin https://x-access-token:${token}@github.com/${repo}.git`, { stdio: "inherit" });

// Apply patch + test
try {
  applyPatch(patchOk.patch);
} catch (e: any) {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Failure\n\nPatch apply failed.\nReason: ${String(e?.message || e)}\n\nTAID: TAID-PPOS-FAIL-0003\nVersion: v0.5.0`,
  });
  process.exit(1);
}

try {
  execSync("npm test", { stdio: "inherit" });
} catch {
  await postIssueComment({
    token,
    repo,
    issueNumber,
    body: `PigPenOS Failure\n\nTests failed; PR not created.\n\nTAID: TAID-PPOS-FAIL-0004\nVersion: v0.5.0`,
  });
  process.exit(1);
}

execSync("git add -A", { stdio: "inherit" });
execSync(`git commit -m "PigPenOS: ${plan.intent} (issue #${issueNumber})"`, { stdio: "inherit" });
execSync(`git push -u origin ${branch}`, { stdio: "inherit" });

const prTitle = `PigPenOS: ${plan.intent} (fixes #${issueNumber})`;
const prBody =
`TID: ${plan.tid}
TAID: TAID-PPOS-PR-0006
TAI-D: TAI-D-PPOS-0006
Version: v0.5.0
Risk: ${patchOk.risk}

Summary:
${patchOk.summary}

Files Changed:
- ${(patchOk.files_changed || []).join("\n- ")}

Tests:
- ${plan.tests.join("\n- ")}

Rollback:
- ${plan.rollback}
`;

const pr = await createPullRequest({ token, repo, title: prTitle, body: prBody, head: branch, base });

await postIssueComment({
  token,
  repo,
  issueNumber,
  body: `PigPenOS Result\n\nPR created: ${pr.html_url}\n\nTAID: TAID-PPOS-RESULT-0002\nVersion: v0.5.0`,
});

function safeRead(path: string): string {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}
