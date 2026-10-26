import type { DraftTask } from "@/lib/partition/ownership";
import type { ImportEdge } from "@/lib/types";

export const MAX_READ_FILES = 24;

/**
 * Context pack = owned files + the files they import directly (read-only), plus anything the
 * partitioner already marked as read-only. Nothing else from the repo is sent to the agent.
 */
export function withContextPacks<T extends Pick<DraftTask, "ownedFiles" | "readFiles">>(
  tasks: T[],
  edges: ImportEdge[],
): T[] {
  const imports = new Map<string, string[]>();
  for (const e of edges) imports.set(e.from, [...(imports.get(e.from) ?? []), e.to]);

  return tasks.map((task) => {
    const owned = new Set(task.ownedFiles);
    const counts = new Map<string, number>();
    for (const file of task.ownedFiles) {
      for (const dep of imports.get(file) ?? []) {
        if (!owned.has(dep)) counts.set(dep, (counts.get(dep) ?? 0) + 1);
      }
    }
    const direct = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([file]) => file);
    const readFiles = [
      ...new Set([...task.readFiles.filter((f) => !owned.has(f)), ...direct]),
    ].slice(0, MAX_READ_FILES);
    return { ...task, readFiles };
  });
}
