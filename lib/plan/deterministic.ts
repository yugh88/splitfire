import path from "node:path/posix";
import type { RepoAnalysis } from "@/lib/analyze/load";
import { rankFiles } from "./relevance";
import type { TaskProposal } from "./schema";

const SEED_FILES = 24;
const MAX_FILES = 48;
const MAX_GROUPS = 6;

/**
 * The no-LLM planner: picks the files most relevant to the request plus their direct imports,
 * groups them into directory communities, and orders groups by import direction.
 */
export function deterministicProposals(analysis: RepoAnalysis, request: string): TaskProposal[] {
  const files = pickFiles(analysis, request);
  const groups = mergeGroups(groupByDirectory(files), analysis);
  const weight = edgeWeights(groups, analysis);

  return groups.map((group) => {
    const kind = group.files.every(isTest) ? "test" : group.files.every(isDoc) ? "docs" : "feature";
    const dependsOn = groups
      .filter((other) => other !== group && weight(group, other) > weight(other, group))
      .map((other) => other.id);
    const n = group.files.length;
    return {
      id: group.id,
      title: `Update ${group.key}`,
      goal: `${request.trim()} — the part that lives in ${group.key} (${n} file${n === 1 ? "" : "s"}).`,
      kind,
      ownedFiles: group.files,
      dependsOn,
      difficulty: n >= 8 ? 3 : n >= 3 ? 2 : 1,
    };
  });
}

type Group = { id: string; key: string; files: string[] };

function pickFiles(analysis: RepoAnalysis, request: string): string[] {
  const source = new Set(analysis.files.filter((f) => f.lang !== "other").map((f) => f.path));
  const ranked = rankFiles(analysis, request).filter((r) => source.has(r.path));
  let seed = ranked
    .filter((r) => r.score > 0)
    .slice(0, SEED_FILES)
    .map((r) => r.path);

  const degree = new Map<string, number>();
  for (const e of analysis.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  if (seed.length === 0) {
    seed = [...source]
      .sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b))
      .slice(0, 12);
  }

  const picked = new Set(seed);
  for (const e of analysis.edges) {
    if (picked.size >= MAX_FILES) break;
    if (seed.includes(e.from) && source.has(e.to)) picked.add(e.to);
  }
  return [...picked].sort();
}

function groupByDirectory(files: string[]): Group[] {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(file);
    const key = dir === "." ? "root" : dir.split("/").slice(0, 2).join("/");
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }
  return [...groups].map(([key, list]) => ({ id: slug(key), key, files: list }));
}

/** Merges singletons and the smallest groups into their most-connected neighbour. */
function mergeGroups(groups: Group[], analysis: RepoAnalysis): Group[] {
  let result = [...groups];
  const shouldMerge = () =>
    result.length > MAX_GROUPS || (result.length > 1 && result.some((g) => g.files.length === 1));
  while (shouldMerge()) {
    const weight = edgeWeights(result, analysis);
    const smallest = [...result].sort(
      (a, b) => a.files.length - b.files.length || a.key.localeCompare(b.key),
    )[0] as Group;
    const others = result.filter((g) => g !== smallest);
    const target = [...others].sort(
      (a, b) =>
        weight(smallest, b) + weight(b, smallest) - (weight(smallest, a) + weight(a, smallest)) ||
        a.files.length - b.files.length ||
        a.key.localeCompare(b.key),
    )[0] as Group;
    result = others.map((g) =>
      g === target ? { ...g, files: [...g.files, ...smallest.files].sort() } : g,
    );
  }
  return result;
}

function edgeWeights(groups: Group[], analysis: RepoAnalysis) {
  const owner = new Map<string, Group>();
  for (const g of groups) for (const f of g.files) owner.set(f, g);
  const counts = new Map<string, number>();
  for (const e of analysis.edges) {
    const a = owner.get(e.from);
    const b = owner.get(e.to);
    if (a && b && a !== b) counts.set(`${a.id}>${b.id}`, (counts.get(`${a.id}>${b.id}`) ?? 0) + 1);
  }
  return (from: Group, to: Group) => counts.get(`${from.id}>${to.id}`) ?? 0;
}

function isTest(file: string): boolean {
  return /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[jt]sx?$|(^|\/)test_[^/]*\.py$/.test(file);
}

function isDoc(file: string): boolean {
  return /\.mdx?$/.test(file);
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "root"
  );
}
