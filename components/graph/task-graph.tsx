"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { type GraphModel, MERGE_ID } from "@/lib/client/graph-model";
import { layoutGraph, type Positions } from "@/lib/client/layout";
import type { TaskStatus } from "@/lib/track/types";
import { MergeTarget, TaskNode, WaveLabel } from "./task-node";

const TASK = { width: 268, height: 124 };
const MERGE = { width: 120, height: 56 };
const nodeTypes = { task: TaskNode, wave: WaveLabel, merge: MergeTarget };

type Props = {
  model: GraphModel;
  agents: number;
  lit: Set<string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
  vertical?: boolean;
  /** Live status per task id, when mission control is on. */
  tracks?: Record<string, TaskStatus>;
};

export function TaskGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

function Flow({ model, agents, lit, selected, onSelect, vertical = false, tracks }: Props) {
  const { fitView } = useReactFlow();
  const [positions, setPositions] = useState<Positions>({});

  const layoutKey = JSON.stringify([
    model.nodes.map((n) => [n.id, n.wave]),
    model.edges.map((e) => e.id),
    vertical,
  ]);
  useEffect(() => {
    let cancelled = false;
    const nodes = model.nodes.map((n) => ({ id: n.id, column: n.wave, size: TASK }));
    if (model.merge) nodes.push({ id: MERGE_ID, column: model.waves.length, size: MERGE });
    layoutGraph(nodes, model.edges, vertical ? "DOWN" : "RIGHT").then((next) => {
      if (cancelled) return;
      setPositions(next);
      requestAnimationFrame(() =>
        fitView({ padding: 0.1, duration: 400, maxZoom: 1, minZoom: 0.8 }),
      );
    });
    return () => {
      cancelled = true;
    };
    // layoutKey captures every input that changes the layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const nodes = useMemo(() => {
    const placed = model.nodes.filter((n) => positions[n.id]);
    const result: Node[] = model.nodes.map((n, i) => ({
      id: n.id,
      type: "task",
      position: positions[n.id] ?? { x: 0, y: i * (TASK.height + 24) },
      data: {
        ...n,
        lit: lit.has(n.id),
        selected: selected === n.id,
        vertical,
        track: tracks?.[n.id],
      },
      draggable: false,
    }));
    for (const wave of model.waves) {
      const members = placed.filter((n) => n.wave === wave.index).map((n) => positions[n.id]!);
      if (members.length === 0) continue;
      const x = Math.min(...members.map((p) => p.x));
      const y = Math.min(...members.map((p) => p.y));
      const width = wave.ids.length > 1 ? ` · ${Math.min(wave.ids.length, agents)} agents` : "";
      result.push({
        id: `wave-${wave.index}`,
        type: "wave",
        position: vertical ? { x: x - 8, y: y - 28 } : { x, y: y - 32 },
        data: { text: `Wave ${wave.index + 1}${width}` },
        selectable: false,
        draggable: false,
      });
    }
    if (model.merge && positions[MERGE_ID]) {
      result.push({
        id: MERGE_ID,
        type: "merge",
        position: positions[MERGE_ID],
        data: { vertical },
        selectable: false,
        draggable: false,
      });
    }
    return result;
  }, [model, positions, lit, selected, vertical, agents, tracks]);

  const edges: Edge[] = model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    style: e.critical
      ? { stroke: "var(--fire-orange)", strokeDasharray: "6 5", strokeWidth: 2 }
      : { stroke: "#2c2c3a", strokeWidth: 1.5 },
    animated: e.critical,
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => node.type === "task" && onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      nodesConnectable={false}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1}
        color="rgba(255,255,255,0.07)"
      />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}
