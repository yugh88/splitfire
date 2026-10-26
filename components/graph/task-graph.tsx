"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import type { GraphModel } from "@/lib/client/graph-model";
import { layoutGraph, type Positions } from "@/lib/client/layout";
import { TaskNode, type TaskFlowNode } from "./task-node";

const NODE_SIZE = { width: 220, height: 104 };
const nodeTypes = { task: TaskNode };

type Props = {
  model: GraphModel;
  lit: Set<string>;
  selected: string | null;
  onSelect: (id: string | null) => void;
};

export function TaskGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}

function Flow({ model, lit, selected, onSelect }: Props) {
  const { fitView } = useReactFlow();
  const vertical = useNarrow();
  const [positions, setPositions] = useState<Positions>({});

  const layoutKey = useMemo(
    () =>
      JSON.stringify([
        model.nodes.map((n) => n.id),
        model.edges.filter((e) => e.kind !== "collision").map((e) => e.id),
        vertical,
      ]),
    [model, vertical],
  );

  useEffect(() => {
    let cancelled = false;
    const deps = model.edges.filter((e) => e.kind !== "collision");
    layoutGraph(
      model.nodes.map((n) => n.id),
      deps,
      NODE_SIZE,
      vertical ? "DOWN" : "RIGHT",
    ).then((next) => {
      if (cancelled) return;
      setPositions(next);
      requestAnimationFrame(() => fitView({ padding: 0.15, duration: 400, maxZoom: 1.1 }));
    });
    return () => {
      cancelled = true;
    };
    // layoutKey captures every input that changes the layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const nodes: TaskFlowNode[] = model.nodes.map((n, index) => ({
    id: n.id,
    type: "task",
    position: positions[n.id] ?? { x: 0, y: index * (NODE_SIZE.height + 24) },
    data: { ...n, lit: lit.has(n.id), selected: selected === n.id, vertical, index },
    draggable: false,
  }));

  const edges: Edge[] = model.edges.map((e) => {
    if (e.kind === "collision") {
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "straight",
        style: { stroke: "var(--fire-red)", strokeDasharray: "6 4", strokeWidth: 2 },
        label: "clash",
        labelStyle: { fill: "var(--fire-red)", fontSize: 10 },
        labelBgStyle: { fill: "var(--card)" },
      };
    }
    const critical = e.kind === "critical";
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      animated: critical,
      style: {
        stroke: critical ? "var(--fire-amber)" : undefined,
        strokeWidth: critical ? 2 : 1.25,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: critical ? "var(--fire-amber)" : "#78716c",
      },
    };
  });

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      nodesConnectable={false}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="rgba(255,255,255,0.06)"
      />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

function useNarrow(breakpoint = 640): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [breakpoint]);
  return narrow;
}
