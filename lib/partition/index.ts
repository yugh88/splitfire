import type { TaskProposal } from "@/lib/plan/schema";
import type { ImportEdge } from "@/lib/types";
import { repairDependencies } from "./dag";
import {
  assignOwnership,
  type Collision,
  collisionScore,
  type DraftTask,
  findCollisions,
  normalizeProposals,
} from "./ownership";
import type { Repair } from "./repairs";

export type DraftSummary = Pick<DraftTask, "id" | "title" | "ownedFiles">;

export type Partition = {
  tasks: DraftTask[];
  draft: DraftSummary[]; // proposals after id/path normalization, before repair
  collisions: Collision[]; // as proposed, before repair (drives the heatmap)
  collisionScoreBefore: number;
  collisionScore: number;
  repairs: Repair[];
};

/** Proposals in, collision-free DAG out. Pure and deterministic. */
export function partition(proposals: TaskProposal[], edges: ImportEdge[]): Partition {
  const normalized = normalizeProposals(proposals);
  const collisions = findCollisions(normalized);
  const owned = assignOwnership(normalized, edges);
  const dag = repairDependencies(owned.tasks);
  return {
    tasks: dag.tasks,
    draft: normalized.map(({ id, title, ownedFiles }) => ({ id, title, ownedFiles })),
    collisions,
    collisionScoreBefore: collisionScore(normalized),
    collisionScore: collisionScore(dag.tasks),
    repairs: [...owned.repairs, ...dag.repairs],
  };
}
