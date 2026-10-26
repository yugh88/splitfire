import type { TaskProposal } from "@/lib/plan/schema";
import type { ImportEdge, Task } from "@/lib/types";

/** A task after partitioning, before cost/model estimates are attached. */
export type DraftTask = Pick<
  Task,
  "id" | "title" | "goal" | "kind" | "ownedFiles" | "readFiles" | "dependsOn" | "difficulty"
>;

export type Collision = { file: string; tasks: string[] };

/** Files claimed by more than one task, in path order. */
export function findCollisions(tasks: Pick<DraftTask, "id" | "ownedFiles">[]): Collision[] {
  const owners = new Map<string, string[]>();
  for (const task of tasks) {
    for (const file of new Set(task.ownedFiles))
      owners.set(file, [...(owners.get(file) ?? []), task.id]);
  }
  return [...owners]
    .filter(([, ids]) => ids.length > 1)
    .map(([file, ids]) => ({ file, tasks: ids }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

/** Number of extra claims on files: 0 means every file has exactly one owner. */
export function collisionScore(tasks: Pick<DraftTask, "id" | "ownedFiles">[]): number {
  return findCollisions(tasks).reduce((sum, c) => sum + c.tasks.length - 1, 0);
}

/** Lowercase slug ids, unique, with dependsOn rewritten to match. */
export function normalizeProposals(proposals: TaskProposal[]): DraftTask[] {
  const used = new Set<string>();
  const rename = new Map<string, string>();
  const ids = proposals.map((p, i) => {
    const base = slug(p.id) || `task-${i + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    if (!rename.has(p.id)) rename.set(p.id, id);
    return id;
  });
  return proposals.map((p, i) => ({
    id: ids[i] ?? `task-${i + 1}`,
    title: p.title.trim(),
    goal: p.goal.trim(),
    kind: p.kind,
    ownedFiles: unique(p.ownedFiles.map(normalizePath).filter(Boolean)),
    readFiles: [],
    dependsOn: unique(p.dependsOn.map((d) => rename.get(d) ?? slug(d))),
    difficulty: Math.min(3, Math.max(1, Math.round(p.difficulty))) as DraftTask["difficulty"],
  }));
}

/**
 * Gives every contested file to the claimant with the most import ties to it (ties: earlier
 * task). Losers keep it as a read-only file. Tasks left owning nothing are dropped.
 */
export function assignOwnership(
  tasks: DraftTask[],
  edges: ImportEdge[],
): { tasks: DraftTask[]; repairs: string[] } {
  const neighbors = new Map<string, Set<string>>();
  const link = (a: string, b: string) => neighbors.set(a, (neighbors.get(a) ?? new Set()).add(b));
  for (const e of edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }

  const order = new Map(tasks.map((t, i) => [t.id, i]));
  const byId = new Map(tasks.map((t) => [t.id, { ...t, ownedFiles: [...t.ownedFiles] }]));
  const repairs: string[] = [];

  for (const { file, tasks: claimants } of findCollisions(tasks)) {
    const affinity = (id: string) => {
      const owned = byId.get(id)?.ownedFiles ?? [];
      return owned.filter((f) => f !== file && neighbors.get(file)?.has(f)).length;
    };
    const winner = [...claimants].sort(
      (a, b) => affinity(b) - affinity(a) || (order.get(a) ?? 0) - (order.get(b) ?? 0),
    )[0];
    for (const id of claimants) {
      const task = byId.get(id);
      if (!task || id === winner) continue;
      task.ownedFiles = task.ownedFiles.filter((f) => f !== file);
      task.readFiles = unique([...task.readFiles, file]);
      repairs.push(`${file}: owned by ${winner}; ${id} reads it`);
    }
  }

  const kept = [...byId.values()].filter((t) => t.ownedFiles.length > 0);
  const dropped = new Map(
    [...byId.values()].filter((t) => t.ownedFiles.length === 0).map((t) => [t.id, t.dependsOn]),
  );
  for (const id of dropped.keys())
    repairs.push(`${id}: dropped, all its files went to other tasks`);
  for (const task of kept)
    task.dependsOn = unique(task.dependsOn.flatMap((d) => inherit(d, dropped)));

  return { tasks: kept, repairs };
}

/** Rewrites a dependency on a dropped task to that task's own dependencies. */
function inherit(id: string, dropped: Map<string, string[]>, seen = new Set<string>()): string[] {
  const deps = dropped.get(id);
  if (!deps) return [id];
  if (seen.has(id)) return [];
  seen.add(id);
  return deps.flatMap((d) => inherit(d, dropped, seen));
}

export function normalizePath(p: string): string {
  return p
    .trim()
    .replace(/\\/g, "/")
    .replace(/^(\.\/|\/)+/, "")
    .replace(/\/+$/, "");
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
