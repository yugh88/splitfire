import type { FileNode } from "@/lib/types";
import { selectFiles, type TreeEntry } from "./filter";
import type { RepoRef } from "./repo-url";

export type RepoSnapshot = {
  owner: string;
  repo: string;
  sha: string;
  files: FileNode[];
  contents: Record<string, string>;
  skipped: number;
  truncated: boolean;
};

export type IngestErrorCode = "not_found" | "rate_limited" | "upstream";

export class IngestError extends Error {
  constructor(
    readonly code: IngestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IngestError";
  }
}

type Fetch = typeof fetch;

type GithubOptions = { token?: string; fetchImpl?: Fetch; concurrency?: number };

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";

/** Resolves a branch, tag or default branch to a commit SHA. */
export async function resolveCommit(ref: RepoRef, opts: GithubOptions = {}): Promise<string> {
  const { owner, repo } = ref;
  let target = ref.ref;
  if (!target) {
    const meta = await api<{ default_branch: string }>(`/repos/${owner}/${repo}`, opts);
    target = meta.default_branch;
  }
  const commit = await api<{ sha: string }>(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(target)}`,
    opts,
  );
  return commit.sha;
}

/** Fetches the file tree and the contents of the selected files at a commit. No clone. */
export async function fetchSnapshot(
  ref: RepoRef,
  sha: string,
  opts: GithubOptions = {},
): Promise<RepoSnapshot> {
  const { owner, repo } = ref;
  const tree = await api<{ tree: { path: string; type: string; size?: number }[] }>(
    `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    opts,
  );
  const entries: TreeEntry[] = tree.tree
    .filter((e) => e.type === "blob")
    .map((e) => ({ path: e.path, bytes: e.size ?? 0 }));
  const { files, skipped, truncated } = selectFiles(entries);

  const contents: Record<string, string> = {};
  await mapLimit(files, opts.concurrency ?? 48, async (file) => {
    contents[file.path] = await raw(owner, repo, sha, file.path, opts);
  });

  return { owner, repo, sha, files, contents, skipped, truncated };
}

async function api<T>(path: string, opts: GithubOptions): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await (opts.fetchImpl ?? fetch)(`${API}${path}`, { headers });
  if (res.ok) return (await res.json()) as T;
  throw toError(res);
}

async function raw(
  owner: string,
  repo: string,
  sha: string,
  path: string,
  opts: GithubOptions,
): Promise<string> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const res = await (opts.fetchImpl ?? fetch)(`${RAW}/${owner}/${repo}/${sha}/${encoded}`);
  if (res.ok) return res.text();
  throw toError(res);
}

function toError(res: Response): IngestError {
  if (res.status === 404) return new IngestError("not_found", "Repo not found or not public.");
  if (res.status === 403 || res.status === 429) {
    return new IngestError("rate_limited", "GitHub rate limit reached. Try again later.");
  }
  return new IngestError("upstream", `GitHub responded ${res.status}.`);
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      await fn(items[next++]);
    }
  });
  await Promise.all(workers);
}
