import type { Task } from "@/lib/types";
import type { PlanState } from "./plan-state";

export type TaskNodeData = {
  id: string;
  title: string;
  kind: Task["kind"];
  files: number;
  difficulty: number;
  estMinutes: number | null;
  model: string | null;
  heat: number; // contested files this task claimed (heatmap)
  critical: boolean;
  final: boolean;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "dep" | "critical" | "collision";
};

export type GraphModel = { nodes: TaskNodeData[]; edges: GraphEdge[] };

/**
 * Turns stream state into graph nodes/edges. `heatmap: "proposed"` shows the collisions the
 * planner proposed; "repaired" shows the final plan, where heat is always zero.
 */
export function graphModel(state: PlanState, heatmap: "off" | "proposed" | "repaired"): GraphModel {
  const final = state.partitioned?.tasks ?? null;
  const critical = state.metrics?.criticalPath ?? [];
  const criticalPairs = new Set(critical.slice(1).map((id, i) => `${critical[i]}>${id}`));

  const heat = new Map<string, number>();
  const collisionEdges: GraphEdge[] = [];
  if (heatmap === "proposed" && state.partitioned) {
    const pairs = new Set<string>();
    for (const c of state.partitioned.collisions) {
      for (const id of c.tasks) heat.set(id, (heat.get(id) ?? 0) + 1);
      for (let i = 1; i < c.tasks.length; i++) pairs.add(`${c.tasks[0]}~${c.tasks[i]}`);
    }
    for (const pair of pairs) {
      const [source = "", target = ""] = pair.split("~");
      collisionEdges.push({ id: `c:${pair}`, source, target, kind: "collision" });
    }
  }

  const tasks = final ?? state.proposals;
  const nodes = tasks.map((t): TaskNodeData => {
    const full = final ? (t as Task) : null;
    return {
      id: t.id,
      title: t.title,
      kind: t.kind,
      files: t.ownedFiles.length,
      difficulty: t.difficulty,
      estMinutes: full?.estMinutes ?? null,
      model: full?.model ?? null,
      heat: heat.get(t.id) ?? 0,
      critical: critical.includes(t.id),
      final: Boolean(final),
    };
  });

  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphEdge[] = tasks.flatMap((t) =>
    t.dependsOn
      .filter((d) => ids.has(d) && d !== t.id)
      .map((d): GraphEdge => ({
        id: `d:${d}>${t.id}`,
        source: d,
        target: t.id,
        kind: criticalPairs.has(`${d}>${t.id}`) ? "critical" : "dep",
      })),
  );

  return {
    nodes,
    edges: [...edges, ...collisionEdges.filter((e) => ids.has(e.source) && ids.has(e.target))],
  };
}

/** Task ids by dependency depth (roots first): the order nodes light up on completion. */
export function litOrder(tasks: { id: string; dependsOn: string[] }[]): string[] {
  const depth = new Map<string, number>();
  const ids = new Set(tasks.map((t) => t.id));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visit = (id: string, seen: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = (byId.get(id)?.dependsOn ?? []).filter((d) => ids.has(d));
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => visit(dep, seen)));
    depth.set(id, d);
    return d;
  };
  tasks.forEach((t) => visit(t.id, new Set()));
  return [...tasks]
    .map((t, i) => ({ id: t.id, d: depth.get(t.id) ?? 0, i }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((t) => t.id);
}
