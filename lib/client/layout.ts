import ELK from "elkjs/lib/elk.bundled.js";

export type Size = { width: number; height: number };
export type Positions = Record<string, { x: number; y: number }>;
export type LayoutNode = { id: string; column: number; size: Size };

const elk = new ELK();

/**
 * Layered layout of the task DAG with one column (or row, top-down) per wave: ELK partitions
 * pin each node to its wave, and ELK orders nodes inside a wave to minimize edge crossings.
 */
export async function layoutGraph(
  nodes: LayoutNode[],
  edges: { id: string; source: string; target: string }[],
  direction: "RIGHT" | "DOWN",
): Promise<Positions> {
  const ids = new Set(nodes.map((n) => n.id));
  const result = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.partitioning.activate": "true",
      "elk.layered.spacing.nodeNodeBetweenLayers": "72",
      "elk.spacing.nodeNode": "24",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    },
    children: nodes.map((n) => ({
      id: n.id,
      ...n.size,
      layoutOptions: { "elk.partitioning.partition": String(n.column) },
    })),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const positions: Positions = {};
  for (const child of result.children ?? [])
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  return positions;
}
