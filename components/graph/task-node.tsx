"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { motion, useReducedMotion } from "framer-motion";
import { Embers } from "@/components/embers";
import { KIND } from "@/components/kind";
import { StatusBadge, TRACK } from "@/components/mission-control/status-badge";
import { dropProps, useResplit } from "@/components/resplit/resplit-context";
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
  const reduce = useReducedMotion();
  const kind = KIND[data.kind];
  const track = data.track ? TRACK[data.track] : null;
  const glowing = data.lit || data.track === "passed";
  const resplit = useResplit();
  const canDrop = Boolean(resplit?.canEdit);
  const isDropTarget = canDrop && resplit?.dragging && resplit.hoveredTask === data.id;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      {...(canDrop && resplit ? dropProps(resplit, data.id) : {})}
      data-testid="task-node"
      data-task-id={data.id}
      data-critical={data.critical}
      data-files={data.files}
      data-minutes={data.estMinutes ?? ""}
      className={cn(
        "bg-card relative w-[268px] cursor-pointer rounded-xl border p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[box-shadow,border-color] duration-500",
        track ? track.node : kind.border,
        track?.glow,
        data.selected &&
          "border-fire-amber/70 ring-fire-amber/30 shadow-[0_0_32px_-12px_var(--fire-amber)] ring-1",
        !data.selected && data.lit && "shadow-[0_0_26px_-12px_var(--fire-orange)]",
        !data.final && "border-dashed",
        isDropTarget && "border-fire-red/80 ring-fire-red/40 animate-pulse ring-2",
      )}
    >
      {data.track === "working" && (
        <motion.span
          aria-hidden
          className="border-fire-amber/60 pointer-events-none absolute -inset-px rounded-xl border"
          animate={
            reduce ? { opacity: 0.45 } : { opacity: [0.15, 0.85, 0.15], scale: [1, 1.015, 1] }
          }
          transition={
            reduce ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
          }
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
            <motion.span
              key={`${data.estMinutes}m`}
              initial={reduce ? false : { opacity: 0.35, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-muted-foreground"
            >
              {data.estMinutes} min
            </motion.span>
          )
        )}
      </div>
      <div className="line-clamp-2 text-base leading-snug font-semibold tracking-[-0.01em]">
        {data.title}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        <motion.span
          key={`${data.files} files`}
          initial={reduce ? false : { scale: 0.85, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 340, damping: 22 }}
          className={cn(
            "rounded-full border px-2 py-px tabular-nums",
            kind.border,
            kind.bg,
            kind.text,
          )}
        >
          {data.files} file{data.files === 1 ? "" : "s"} owned
        </motion.span>
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
    <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em] whitespace-nowrap uppercase">
      {data.text}
    </div>
  );
}

export function MergeTarget({ data }: NodeProps<MergeNode>) {
  return (
    <div className="border-ok-green/50 bg-ok-green/[0.04] w-[120px] rounded-xl border border-dashed px-3 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <Handle
        type="target"
        position={data.vertical ? Position.Top : Position.Left}
        className="!opacity-0"
      />
      <div className="font-display text-ok-green text-xs font-bold tracking-[0.12em]">MERGE</div>
      <div className="text-muted-foreground text-[11px]">all gates pass</div>
    </div>
  );
}
