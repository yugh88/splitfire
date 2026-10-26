import { modelTier } from "@/lib/cost/estimate";
import type { Task } from "@/lib/types";
import { taskLabels, type Wave, waves } from "@/lib/partition/waves";
import type { PlanState } from "./plan-state";

export { taskLabels, type Wave, waves };

type Deps = { id: string; dependsOn: string[] };

export const MERGE_ID = "__merge__";

export type TaskNodeData = {
  id: string;
  label: string; // "T0", "T1", … in wave order
  title: string;
  kind: Task["kind"];
  files: number;
  estMinutes: number | null;
  tier: "strong" | "fast";
  wave: number;
  critical: boolean;
  final: boolean;
};

export type GraphEdge = { id: string; source: string; target: string; critical: boolean };

export type GraphModel = {
  nodes: TaskNodeData[];
  edges: GraphEdge[];
  waves: Wave[];
  merge: boolean;
};

/** Turns stream state into graph nodes and edges, plus a merge node once the plan is final. */
export function graphModel(state: PlanState): GraphModel {
  const final = state.partitioned?.tasks ?? null;
  const tasks: (Deps & Pick<Task, "title" | "kind" | "ownedFiles"> & { difficulty: number })[] =
    final ?? state.proposals;
  const critical = state.metrics?.criticalPath ?? [];
  const criticalPairs = new Set(critical.slice(1).map((id, i) => `${critical[i]}>${id}`));
  const estimates = new Map((final ?? []).map((t) => [t.id, t.estMinutes]));
  const grouped = waves(tasks);
  const waveOf = new Map(grouped.flatMap((w) => w.ids.map((id) => [id, w.index] as const)));
  const labels = taskLabels(tasks);
  const ids = new Set(tasks.map((t) => t.id));

  const nodes = tasks.map((t): TaskNodeData => ({
    id: t.id,
    label: labels.get(t.id) ?? "T?",
    title: t.title,
    kind: t.kind,
    files: t.ownedFiles.length,
    estMinutes: estimates.get(t.id) ?? null,
    tier: modelTier(t.difficulty),
    wave: waveOf.get(t.id) ?? 0,
    critical: critical.includes(t.id),
    final: Boolean(final),
  }));

  const edges: GraphEdge[] = tasks.flatMap((t) =>
    t.dependsOn
      .filter((d) => ids.has(d) && d !== t.id)
      .map((d) => ({
        id: `d:${d}>${t.id}`,
        source: d,
        target: t.id,
        critical: criticalPairs.has(`${d}>${t.id}`),
      })),
  );

  const merge = Boolean(final) && tasks.length > 0;
  if (merge) {
    const hasDependents = new Set(edges.map((e) => e.source));
    const last = critical.at(-1);
    for (const t of tasks) {
      if (hasDependents.has(t.id)) continue;
      edges.push({ id: `m:${t.id}`, source: t.id, target: MERGE_ID, critical: t.id === last });
    }
  }

  return { nodes, edges, waves: grouped, merge };
}
