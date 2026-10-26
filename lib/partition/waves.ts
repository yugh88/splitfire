type Deps = { id: string; dependsOn: string[] };

export type Wave = { index: number; ids: string[] };

/** Groups tasks by dependency depth: wave 0 has no dependencies, wave n waits on wave n-1. */
export function waves(tasks: Deps[]): Wave[] {
  const ids = new Set(tasks.map((t) => t.id));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = (byId.get(id)?.dependsOn ?? []).filter((d) => ids.has(d) && d !== id);
    const d = deps.length === 0 ? 0 : 1 + Math.max(...deps.map((dep) => visit(dep, seen)));
    depth.set(id, d);
    return d;
  };
  tasks.forEach((t) => visit(t.id, new Set()));

  const result: Wave[] = [];
  for (const t of tasks) {
    const index = depth.get(t.id) ?? 0;
    while (result.length <= index) result.push({ index: result.length, ids: [] });
    result[index]?.ids.push(t.id);
  }
  return result;
}

/** "T0", "T1", … numbered wave by wave, keeping the planner's order inside a wave. */
export function taskLabels(tasks: Deps[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const wave of waves(tasks)) for (const id of wave.ids) labels.set(id, `T${labels.size}`);
  return labels;
}
