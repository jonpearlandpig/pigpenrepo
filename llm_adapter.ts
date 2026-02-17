/**
 * PigPenOS Patch Contract v1.0
 * TID: TID-PPOS-0001
 * TAID: TAID-PPOS-ADAPTER-0001
 * Version: v0.5.0
 */

type PigPenPatchRequestV1 = {
  meta: {
    tid: string;
    taid: string;
    version: string;
    repo: string;
    issue_number: number;
    base_branch: string;
  };
  intent: {
    issue_title: string;
    issue_body: string;
    comment_body: string;
  };
  constraints: {
    max_files: number;
    max_diff_lines: number;
    must_include_tests: boolean;
    forbidden_paths: string[];
  };
  context_files: { path: string; content: string }[];
};

type PigPenPatchResponseV1 =
  | {
      status: "ok";
      summary: string;
      risk: "low" | "medium" | "high";
      files_changed: string[];
      patch: string;
      validation: {
        tests_included: boolean;
        forbidden_paths_touched: boolean;
        estimated_diff_lines: number;
      };
    }
  | { status: "refused"; reason: string; risk: "low" | "medium" | "high" }
  | { status: "error"; reason: string };

export async function healthCheck(): Promise<void> {
  const endpoint = process.env.PIGPEN_LLM_ENDPOINT;
  const key = process.env.PIGPEN_API_KEY;

  if (!endpoint || !key) {
    throw new Error("Patch service not configured: PIGPEN_LLM_ENDPOINT / PIGPEN_API_KEY missing.");
  }

  const healthUrl = endpoint.replace(/\/+$/, "") + "/health";
  const res = await fetch(healthUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "X-PigPen-Version": "1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Patch service health failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { status?: string };
  if (data.status !== "ok") throw new Error(`Patch service unhealthy: ${JSON.stringify(data)}`);
}

export async function requestPatchV1(params: {
  tid: string;
  taid: string;
  version: string;
  repo: string;
  issueNumber: number;
  baseBranch: string;
  issueTitle: string;
  issueBody: string;
  commentBody: string;
  forbiddenPaths: string[];
  contextFiles: { path: string; content: string }[];
  mustIncludeTests: boolean;
  maxFiles: number;
  maxDiffLines: number;
}): Promise<Extract<PigPenPatchResponseV1, { status: "ok" }>> {
  const endpoint = process.env.PIGPEN_LLM_ENDPOINT;
  const key = process.env.PIGPEN_API_KEY;

  if (!endpoint || !key) {
    throw new Error("IMPLEMENT refused: PIGPEN_LLM_ENDPOINT / PIGPEN_API_KEY not set.");
  }

  const url = endpoint.replace(/\/+$/, "") + "/pigpen/patch";

  const payload: PigPenPatchRequestV1 = {
    meta: {
      tid: params.tid,
      taid: params.taid,
      version: params.version,
      repo: params.repo,
      issue_number: params.issueNumber,
      base_branch: params.baseBranch,
    },
    intent: {
      issue_title: params.issueTitle,
      issue_body: params.issueBody,
      comment_body: params.commentBody,
    },
    constraints: {
      max_files: params.maxFiles,
      max_diff_lines: params.maxDiffLines,
      must_include_tests: params.mustIncludeTests,
      forbidden_paths: params.forbiddenPaths,
    },
    context_files: params.contextFiles,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-PigPen-Version": "1.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Patch service error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as PigPenPatchResponseV1;

  if (data.status === "ok") return data;

  if (data.status === "refused") {
    throw new Error(`Patch refused: ${data.reason} (risk=${data.risk})`);
  }

  throw new Error(`Patch error: ${data.reason}`);
}
