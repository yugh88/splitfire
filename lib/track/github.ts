import { config } from "@/lib/env";
import { taskLabels } from "@/lib/partition/waves";
import { kv, type KV } from "@/lib/store/kv";
import type { Task } from "@/lib/types";
import { deriveTaskStatus, type CheckRunState } from "./status";
import type { TaskTrack } from "./types";

const API = "https://api.github.com";
/** Cached snapshots protect the GitHub rate limit between polls. */
export const TRACK_CACHE_SECONDS = 10;

export type TrackPlan = {
  id: string;
  /** `owner/name`, as stored on the plan. */
  repo: string;
  /** The commit the plan was built against. */
  sha: string;
  tasks: Pick<Task, "id" | "dependsOn">[];
};

export type TrackDeps = {
  token?: string;
  fetchImpl?: typeof fetch;
  store?: KV;
  now?: () => number;
};

export type TrackErrorCode = "bad_repo" | "not_found" | "rate_limited" | "upstream";

export class TrackError extends Error {
  constructor(
    readonly code: TrackErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TrackError";
  }
}

type Ref = { ref: string; object: { sha: string } };
type Compare = { status: string; ahead_by?: number };
type CheckRun = {
  name: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  html_url?: string;
};
type CheckRunsResponse = { check_runs: CheckRun[] };

/**
 * Fetches the live status of every task on a plan from the GitHub REST API.
 * Results are cached for TRACK_CACHE_SECONDS per plan id.
 */
export async function getTracks(plan: TrackPlan, deps: TrackDeps = {}): Promise<TaskTrack[]> {
  const store = deps.store ?? kv();
  const cacheKey = `track:${plan.id}`;
  const cached = await store.get<TaskTrack[]>(cacheKey);
  if (cached) return cached;

  const [owner, repo] = plan.repo.split("/");
  if (!owner || !repo) throw new TrackError("bad_repo", "Plan repo is not owner/name.");

  const opts: TrackDeps = { ...deps, token: deps.token ?? config().githubToken };
  const [meta, refs] = await Promise.all([
    api<{ default_branch: string }>(`/repos/${owner}/${repo}`, opts),
    api<Ref[]>(`/repos/${owner}/${repo}/git/matching-refs/heads/splitfire/`, opts),
  ]);

  const heads = new Map(
    refs.map((ref) => [ref.ref.replace(/^refs\/heads\//, ""), ref.object.sha] as const),
  );
  const labels = taskLabels(plan.tasks);
  const updatedAt = new Date((deps.now ?? Date.now)()).toISOString();

  const tracks = await Promise.all(
    plan.tasks.map(async (task): Promise<TaskTrack> => {
      const label = labels.get(task.id) ?? task.id;
      const branch = `splitfire/${label}`;
      const headSha = heads.get(branch);
      if (!headSha) {
        return { taskId: task.id, status: "waiting", branch, updatedAt };
      }

      const diff = await compare(owner, repo, plan.sha, headSha, opts);
      const aheadOfBase =
        diff.status === "ahead" || diff.status === "diverged" || (diff.ahead_by ?? 0) > 0;
      if (!aheadOfBase) {
        return {
          taskId: task.id,
          status: deriveTaskStatus({ branchExists: true, aheadOfBase: false, merged: false }),
          branch,
          headSha,
          updatedAt,
        };
      }

      // Reachable from the default branch means merged; skip check-run traffic for merged tasks.
      const landed = await compare(owner, repo, meta.default_branch, headSha, opts);
      const merged = landed.status === "behind" || landed.status === "identical";
      const check = merged ? null : await latestCheck(owner, repo, headSha, branch, opts);
      const status = deriveTaskStatus({
        branchExists: true,
        aheadOfBase,
        merged,
        checkRun: check?.state ?? null,
      });

      return {
        taskId: task.id,
        status,
        branch,
        headSha,
        ...(check?.url ? { checkUrl: check.url } : {}),
        updatedAt,
      };
    }),
  );

  await store.set(cacheKey, tracks, TRACK_CACHE_SECONDS);
  return tracks;
}

async function compare(
  owner: string,
  repo: string,
  base: string,
  head: string,
  opts: TrackDeps,
): Promise<Compare> {
  return api<Compare>(`/repos/${owner}/${repo}/compare/${base}...${head}`, opts);
}

async function latestCheck(
  owner: string,
  repo: string,
  headSha: string,
  name: string,
  opts: TrackDeps,
): Promise<{ state: CheckRunState; url?: string } | null> {
  const path = `/repos/${owner}/${repo}/commits/${headSha}/check-runs?check_name=${encodeURIComponent(name)}&per_page=1`;
  const data = await api<CheckRunsResponse>(path, opts);
  const run = data.check_runs.find((r) => r.name === name && r.head_sha === headSha);
  if (!run) return null;
  return { state: { status: run.status, conclusion: run.conclusion }, url: run.html_url };
}

async function api<T>(path: string, opts: TrackDeps): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await (opts.fetchImpl ?? fetch)(`${API}${path}`, { headers, cache: "no-store" });
  if (res.ok) return (await res.json()) as T;
  if (res.status === 404) throw new TrackError("not_found", "Repo, branch or commit not found.");
  if (res.status === 403 || res.status === 429) {
    throw new TrackError("rate_limited", "GitHub rate limit reached. Try again shortly.");
  }
  throw new TrackError("upstream", `GitHub responded ${res.status}.`);
}
