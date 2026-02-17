export async function githubRequest<T>(params: {
  token: string;
  method: "GET" | "POST" | "PUT" | "PATCH";
  url: string;
  body?: any;
}): Promise<T> {
  const res = await fetch(params.url, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/vnd.github+json",
      ...(params.body ? { "Content-Type": "application/json" } : {}),
    },
    body: params.body ? JSON.stringify(params.body) : undefined,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${t}`);
  }

  return (await res.json()) as T;
}

export async function postIssueComment(params: {
  token: string;
  repo: string;
  issueNumber: number;
  body: string;
}) {
  await githubRequest({
    token: params.token,
    method: "POST",
    url: `https://api.github.com/repos/${params.repo}/issues/${params.issueNumber}/comments`,
    body: { body: params.body },
  });
}

export async function getUserPermission(params: {
  token: string;
  repo: string;
  username: string;
}): Promise<"read" | "triage" | "write" | "maintain" | "admin"> {
  type Resp = { permission: "read" | "triage" | "write" | "maintain" | "admin" };
  const data = await githubRequest<Resp>({
    token: params.token,
    method: "GET",
    url: `https://api.github.com/repos/${params.repo}/collaborators/${params.username}/permission`,
  });
  return data.permission;
}

export async function createPullRequest(params: {
  token: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
}) {
  type Resp = { html_url: string; number: number };
  return await githubRequest<Resp>({
    token: params.token,
    method: "POST",
    url: `https://api.github.com/repos/${params.repo}/pulls`,
    body: { title: params.title, body: params.body, head: params.head, base: params.base },
  });
}
