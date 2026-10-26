"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import type { Wave } from "@/lib/client/graph-model";
import type { Metrics } from "@/lib/plan/events";
import type { Task } from "@/lib/types";
import { formatMinutes, formatTokens, formatUsd, percentSaved, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  metrics: Metrics;
  tasks: Task[];
  waves: Wave[];
  collisionsBefore: number;
  compact?: boolean;
};

/** Speedup, collisions, agents, context and cost, as in the design's top row. */
export function MetricCards({ metrics, tasks, waves, collisionsBefore, compact }: Props) {
  const saved = percentSaved(metrics.tokensFullRepo, metrics.tokensWithPacks);
  const models = new Set(tasks.map((t) => t.model)).size;
  return (
    <section
      aria-label="Plan metrics"
      className={cn(
        "grid gap-3",
        compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
      )}
    >
      <Card label="Speedup" tone="amber" value={`${metrics.speedup}×`}>
        Serial {formatMinutes(metrics.serialMinutes)} → {formatMinutes(metrics.parallelMinutes)}
      </Card>
      <Card label="Collisions" tone="green" value={<Counter value={metrics.collisionScore} />}>
        {collisionsBefore > 0
          ? `${plural(collisionsBefore, "overlap")} auto-repaired`
          : "no overlaps proposed"}
      </Card>
      {!compact && (
        <Card label="Agents" value={String(metrics.agents)}>
          {plural(tasks.length, "task")} · {plural(waves.length, "wave")}
        </Card>
      )}
      <Card label="Context" tone="blue" value={`−${saved}%`}>
        {formatTokens(metrics.tokensFullRepo)} → {formatTokens(metrics.tokensWithPacks)} tokens
      </Card>
      <Card label="Est. cost" value={formatUsd(metrics.totalCostUsd)}>
        {plural(models, "open model")}
        {models > 1 ? ", routed" : ""}
      </Card>
    </section>
  );
}

const TONE = {
  amber: "border-fire-amber/30 text-fire-amber",
  green: "border-ok-green/30 text-ok-green",
  blue: "border-border text-contract-blue",
  plain: "border-border text-foreground",
};

function Card({
  label,
  value,
  tone = "plain",
  children,
}: {
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof TONE;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("bg-card rounded-xl border px-4 py-3", TONE[tone].split(" ")[0])}>
      <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        {label}
      </div>
      <div className={cn("font-heading my-1 text-2xl sm:text-3xl", TONE[tone].split(" ")[1])}>
        {value}
      </div>
      <div className="text-muted-foreground hidden text-xs sm:block">{children}</div>
    </div>
  );
}

function Counter({ value }: { value: number }) {
  const count = useMotionValue(value);
  const rounded = useTransform(count, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [count, value]);
  return <motion.span>{rounded}</motion.span>;
}
