"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { FileCode2, Flame, Timer } from "lucide-react";
import { Embers } from "@/components/embers";
import type { TaskNodeData } from "@/lib/client/graph-model";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskFlowNode = Node<
  TaskNodeData & { lit: boolean; selected: boolean; vertical: boolean; index: number },
  "task"
>;

const KIND_STYLE: Record<TaskNodeData["kind"], string> = {
  contract: "text-fire-amber border-fire-amber/40",
  feature: "text-fire-orange border-fire-orange/40",
  test: "text-sky-300 border-sky-300/40",
  docs: "text-stone-300 border-stone-300/40",
};

export function TaskNode({ data }: NodeProps<TaskFlowNode>) {
  const hot = data.heat > 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "bg-card/95 relative w-[220px] rounded-lg border p-3 text-left shadow-lg transition-[box-shadow,border-color] duration-500",
        data.selected ? "border-primary" : "border-border",
        hot && "border-fire-red shadow-[0_0_24px_-4px_var(--fire-red)]",
        !hot && data.lit && "shadow-[0_0_22px_-6px_var(--fire-orange)]",
        !data.final && "border-dashed opacity-90",
      )}
    >
      {data.lit && !hot && <Embers seed={data.index + 1} count={8} />}
      <Handle
        type="target"
        position={data.vertical ? Position.Top : Position.Left}
        className="!bg-primary/60"
      />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-heading rounded border px-1.5 py-px text-[9px] tracking-wider uppercase",
            KIND_STYLE[data.kind],
          )}
        >
          {data.kind}
        </span>
        {data.critical && data.final && (
          <span
            title="On the critical path"
            className="text-fire-amber flex items-center gap-1 text-[10px]"
          >
            <Flame className="size-3" /> critical
          </span>
        )}
      </div>
      <div className="line-clamp-2 text-sm leading-snug font-medium">{data.title}</div>
      <div className="text-muted-foreground mt-2 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <FileCode2 className="size-3" /> {data.files}
        </span>
        {data.estMinutes !== null && (
          <span className="flex items-center gap-1">
            <Timer className="size-3" /> {formatMinutes(data.estMinutes)}
          </span>
        )}
        <span aria-label={`difficulty ${data.difficulty}`}>{"▮".repeat(data.difficulty)}</span>
        {hot && <span className="text-fire-red ml-auto font-medium">{data.heat} clash</span>}
      </div>
      <Handle
        type="source"
        position={data.vertical ? Position.Bottom : Position.Right}
        className="!bg-primary/60"
      />
    </motion.div>
  );
}
