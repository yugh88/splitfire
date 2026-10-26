import type { TaskProposal } from "@/lib/plan/schema";
import type { ImportEdge, Task } from "@/lib/types";
import type { Repair } from "./repairs";

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

/** The ownership fields a re-split can touch; every other task field is preserved. */
export type OwnedFiles = { id: string; ownedFiles: string[]; readFiles: string[] };

/** Collision state recomputed for a set of tasks after an ownership change. */
export type CollisionState = { collisions: Collision[]; collisionScore: number };

/** Recomputes collisions and the collision score for the given ownership. */
export function rescoreOwnership(tasks: Pick<DraftTask, "id" | "ownedFiles">[]): CollisionState {
  return { collisions: findCollisions(tasks), collisionScore: collisionScore(tasks) };
}

/** Result of a re-split: the updated tasks, the new collision state, and whether anything moved. */
export type Resplit<T> = CollisionState & { tasks: T[]; changed: boolean };

/**
 * Moves `file` to `toTaskId` and recomputes the collision score, for the interactive re-split
 * (a drag between task cards). The file leaves every other owner and becomes read-only context
 * for tasks that used to own it. A task left owning nothing is kept so the move can be undone;
 * unknown files or task ids leave the plan untouched. Pure: the input tasks are not mutated.
 */
export function reassignFile<T extends OwnedFiles>(
  tasks: T[],
  file: string,
  toTaskId: string,
): Resplit<T> {
  const path = normalizePath(file);
  const target = tasks.find((t) => t.id === toTaskId);
  if (!path || !target) return { tasks, ...rescoreOwnership(tasks), changed: false };

  let changed = false;
  const next = tasks.map((task) => {
    if (task.id === toTaskId) {
      const ownedFiles = unique([...task.ownedFiles, path]);
      const readFiles = task.readFiles.filter((f) => f !== path);
      if (
        ownedFiles.length === task.ownedFiles.length &&
        readFiles.length === task.readFiles.length
      )
        return task;
      changed = true;
      return { ...task, ownedFiles, readFiles };
    }
    if (!task.ownedFiles.includes(path)) return task;
    changed = true;
    return {
      ...task,
      ownedFiles: task.ownedFiles.filter((f) => f !== path),
      readFiles: unique([...task.readFiles, path]),
    };
  });

  if (!changed) return { tasks, ...rescoreOwnership(tasks), changed: false };
  return { tasks: next, ...rescoreOwnership(next), changed: true };
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
): { tasks: DraftTask[]; repairs: Repair[] } {
  const neighbors = new Map<string, Set<string>>();
  const link = (a: string, b: string) => neighbors.set(a, (neighbors.get(a) ?? new Set()).add(b));
  for (const e of edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }

  const order = new Map(tasks.map((t, i) => [t.id, i]));
  const byId = new Map(tasks.map((t) => [t.id, { ...t, ownedFiles: [...t.ownedFiles] }]));
  const repairs: Repair[] = [];

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
      repairs.push({ kind: "owner", file, winner, loser: id });
    }
  }

  const kept = [...byId.values()].filter((t) => t.ownedFiles.length > 0);
  const dropped = new Map(
    [...byId.values()].filter((t) => t.ownedFiles.length === 0).map((t) => [t.id, t.dependsOn]),
  );
  for (const id of dropped.keys()) {
    repairs.push({ kind: "dropped", task: id });
  }
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
