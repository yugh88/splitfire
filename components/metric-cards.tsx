"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Annotation } from "@/components/annotation";
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
      <Card label="Speedup" tone="amber" value={`${metrics.speedup}×`} index={0}>
        Serial {formatMinutes(metrics.serialMinutes)} → {formatMinutes(metrics.parallelMinutes)}
      </Card>
      <Card
        label="Collisions"
        tone="green"
        value={<Counter value={metrics.collisionScore} />}
        index={1}
        annotation={
          <Annotation arrow="down" className="absolute -top-6 right-2 hidden md:inline-flex">
            zero merge conflicts
          </Annotation>
        }
      >
        {collisionsBefore > 0
          ? `${plural(collisionsBefore, "overlap")} auto-repaired`
          : "no overlaps proposed"}
      </Card>
      {!compact && (
        <Card label="Agents" value={String(metrics.agents)} index={2}>
          {plural(tasks.length, "task")} · {plural(waves.length, "wave")}
        </Card>
      )}
      <Card label="Context" tone="blue" value={`−${saved}%`} index={3}>
        {formatTokens(metrics.tokensFullRepo)} → {formatTokens(metrics.tokensWithPacks)} tokens
      </Card>
      <Card label="Est. cost" value={formatUsd(metrics.totalCostUsd)} index={4}>
        {plural(models, "open model")}
        {models > 1 ? ", routed" : ""}
      </Card>
    </section>
  );
}

const TONE = {
  amber: "border-fire-amber/25 text-fire-amber",
  green: "border-ok-green/25 text-ok-green",
  blue: "border-contract-blue/20 text-contract-blue",
  plain: "border-border text-foreground",
};

function Card({
  label,
  value,
  tone = "plain",
  index = 0,
  annotation,
  children,
}: {
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof TONE;
  index?: number;
  annotation?: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.45,
        delay: reduce ? 0 : Math.min(index, 4) * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        "bg-card relative rounded-2xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-300",
        TONE[tone].split(" ")[0],
      )}
    >
      {annotation}
      <div className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
        {label}
      </div>
      <div
        className={cn(
          "font-display my-1 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl",
          TONE[tone].split(" ")[1],
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground hidden text-xs sm:block">{children}</div>
    </motion.div>
  );
}

function Counter({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const count = useMotionValue(value);
  const rounded = useTransform(count, (v) => Math.round(v).toString());
  useEffect(() => {
    if (reduce) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [count, value, reduce]);
  return <motion.span>{rounded}</motion.span>;
}
