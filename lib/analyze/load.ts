import { fetchSnapshot, resolveCommit } from "@/lib/ingest/github";
import type { RepoRef } from "@/lib/ingest/repo-url";
import { kv, type KV } from "@/lib/store/kv";
import type { FileNode, ImportEdge } from "@/lib/types";
import { buildImportGraph, type ImportGraph } from "./graph";

/** Everything downstream modules need about a repo. Holds no source code (privacy). */
export type RepoAnalysis = {
  repo: string;
  sha: string;
  files: FileNode[];
  edges: ImportEdge[];
  symbols: Record<string, string[]>;
  parser: ImportGraph["parser"];
  skipped: number;
  truncated: boolean;
};

export type LoadResult = { analysis: RepoAnalysis; cacheHit: boolean };

const CACHE_TTL_SECONDS = 7 * 24 * 3600;

/** Ingests and analyzes a repo, cached by commit SHA under `tree:{owner}/{repo}@{sha}`. */
export async function loadRepoAnalysis(
  ref: RepoRef,
  opts: { token?: string; store?: KV; fetchImpl?: typeof fetch } = {},
): Promise<LoadResult> {
  const store = opts.store ?? kv();
  const sha = await resolveCommit(ref, opts);
  const key = `tree:${ref.owner}/${ref.repo}@${sha}`;

  const cached = await store.get<RepoAnalysis>(key);
  if (cached) return { analysis: cached, cacheHit: true };

  const snapshot = await fetchSnapshot(ref, sha, opts);
  const graph = await buildImportGraph(snapshot.files, snapshot.contents);
  const analysis: RepoAnalysis = {
    repo: `${ref.owner}/${ref.repo}`,
    sha,
    files: snapshot.files,
    edges: graph.edges,
    symbols: graph.symbols,
    parser: graph.parser,
    skipped: snapshot.skipped,
    truncated: snapshot.truncated,
  };
  await store.set(key, analysis, CACHE_TTL_SECONDS);
  return { analysis, cacheHit: false };
}
