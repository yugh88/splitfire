"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { Embers } from "@/components/embers";
import { KIND } from "@/components/kind";
import { StatusBadge, TRACK } from "@/components/mission-control/status-badge";
import type { TaskNodeData } from "@/lib/client/graph-model";
import type { TaskStatus } from "@/lib/track/types";
import { cn } from "@/lib/utils";

export type TaskFlowNode = Node<
  TaskNodeData & { lit: boolean; selected: boolean; vertical: boolean; track?: TaskStatus },
  "task"
>;
export type WaveLabelNode = Node<{ text: string }, "wave">;
export type MergeNode = Node<{ vertical: boolean }, "merge">;

export function TaskNode({ data }: NodeProps<TaskFlowNode>) {
  const kind = KIND[data.kind];
  const track = data.track ? TRACK[data.track] : null;
  const glowing = data.lit || data.track === "passed";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "bg-card relative w-[268px] cursor-pointer rounded-lg border p-3 text-left transition-[box-shadow,border-color] duration-500",
        track ? track.node : kind.border,
        track?.glow,
        data.selected && "border-fire-amber border-2 shadow-[0_0_28px_-6px_var(--fire-amber)]",
        !data.selected && data.lit && "shadow-[0_0_22px_-8px_var(--fire-orange)]",
        !data.final && "border-dashed",
      )}
    >
      {data.track === "working" && (
        <motion.span
          aria-hidden
          className="border-fire-amber pointer-events-none absolute -inset-px rounded-lg border"
          animate={{ opacity: [0.15, 0.85, 0.15], scale: [1, 1.015, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {glowing && <Embers seed={data.label.length + data.wave} count={6} />}
      <Handle
        type="target"
        position={data.vertical ? Position.Top : Position.Left}
        className="!opacity-0"
      />
      <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-xs">
        <span className={kind.text}>
          {data.label} · {data.kind.toUpperCase()}
        </span>
        {data.track ? (
          <StatusBadge status={data.track} compact />
        ) : (
          data.estMinutes !== null && (
            <span className="text-muted-foreground">{data.estMinutes} min</span>
          )
        )}
      </div>
      <div className="line-clamp-2 text-base leading-snug font-semibold">{data.title}</div>
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        <span className={cn("rounded-full border px-2 py-px", kind.border, kind.bg, kind.text)}>
          {data.files} file{data.files === 1 ? "" : "s"} owned
        </span>
        <span className="text-muted-foreground">{data.tier} model</span>
      </div>
      <Handle
        type="source"
        position={data.vertical ? Position.Bottom : Position.Right}
        className="!opacity-0"
      />
    </motion.div>
  );
}

export function WaveLabel({ data }: NodeProps<WaveLabelNode>) {
  return (
    <div className="font-heading text-muted-foreground text-[11px] tracking-widest whitespace-nowrap uppercase">
      {data.text}
    </div>
  );
}

export function MergeTarget({ data }: NodeProps<MergeNode>) {
  return (
    <div className="border-ok-green/70 bg-ok-green/5 w-[120px] rounded-lg border border-dashed px-3 py-2 text-center">
      <Handle
        type="target"
        position={data.vertical ? Position.Top : Position.Left}
        className="!opacity-0"
      />
      <div className="font-heading text-ok-green text-xs">MERGE</div>
      <div className="text-muted-foreground text-[11px]">all gates pass</div>
    </div>
  );
}
