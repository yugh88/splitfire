import ELK from "elkjs/lib/elk.bundled.js";

export type Size = { width: number; height: number };
export type Positions = Record<string, { x: number; y: number }>;

const elk = new ELK();

/** Layered left-to-right (or top-down on narrow screens) layout of the task DAG. */
export async function layoutGraph(
  nodes: string[],
  edges: { id: string; source: string; target: string }[],
  size: Size,
  direction: "RIGHT" | "DOWN",
): Promise<Positions> {
  const ids = new Set(nodes);
  const result = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.layered.spacing.nodeNodeBetweenLayers": "64",
      "elk.spacing.nodeNode": "28",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    },
    children: nodes.map((id) => ({ id, ...size })),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const positions: Positions = {};
  for (const child of result.children ?? [])
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  return positions;
}
