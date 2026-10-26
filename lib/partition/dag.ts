import { DirectedGraph } from "graphology";
import { hasCycle, topologicalSort } from "graphology-dag";
import type { DraftTask } from "./ownership";

type Deps = Pick<DraftTask, "id" | "dependsOn">;

export function taskGraph(tasks: Deps[]): DirectedGraph {
  const graph = new DirectedGraph();
  for (const t of tasks) graph.addNode(t.id);
  for (const t of tasks) {
    for (const dep of t.dependsOn) {
      if (graph.hasNode(dep) && dep !== t.id) graph.mergeEdge(dep, t.id);
    }
  }
  return graph;
}

export function isAcyclic(tasks: Deps[]): boolean {
  return !hasCycle(taskGraph(tasks));
}

/** Task ids with every dependency before its dependents. Requires an acyclic plan. */
export function topoOrder(tasks: Deps[]): string[] {
  return topologicalSort(taskGraph(tasks));
}

/**
 * Drops unknown and self dependencies, then removes back-edges found by a DFS in task order,
 * which makes the dependency graph a DAG deterministically.
 */
export function repairDependencies<T extends Deps>(tasks: T[]): { tasks: T[]; repairs: string[] } {
  const ids = new Set(tasks.map((t) => t.id));
  const repairs: string[] = [];
  const deps = new Map(
    tasks.map((t) => {
      const valid = t.dependsOn.filter((d) => {
        const ok = d !== t.id && ids.has(d);
        if (!ok) repairs.push(`${t.id}: removed invalid dependency on ${d}`);
        return ok;
      });
      return [t.id, valid];
    }),
  );

  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string) => {
    state.set(id, "visiting");
    for (const dep of [...(deps.get(id) ?? [])]) {
      if (state.get(dep) === "visiting") {
        deps.set(
          id,
          (deps.get(id) ?? []).filter((d) => d !== dep),
        );
        repairs.push(`${id}: removed dependency on ${dep} to break a cycle`);
      } else if (!state.has(dep)) {
        visit(dep);
      }
    }
    state.set(id, "done");
  };
  for (const t of tasks) if (!state.has(t.id)) visit(t.id);

  return { tasks: tasks.map((t) => ({ ...t, dependsOn: deps.get(t.id) ?? [] })), repairs };
}
