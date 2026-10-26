"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import type { Metrics } from "@/lib/plan/events";
import { formatMinutes, formatTokens, formatUsd, percentSaved } from "@/lib/format";

type Props = {
  metrics: Metrics;
  collisionsShown: number;
  collisionsBefore: number;
  heatmapOn: boolean;
  onHeatmap: (on: boolean) => void;
};

export function MetricsBar({
  metrics,
  collisionsShown,
  collisionsBefore,
  heatmapOn,
  onHeatmap,
}: Props) {
  const saved = percentSaved(metrics.tokensFullRepo, metrics.tokensWithPacks);
  return (
    <section
      aria-label="Plan metrics"
      className="border-border bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4"
    >
      <Stat label="Speedup" wide>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-heading text-fire text-3xl">{metrics.speedup}×</span>
          <span className="text-muted-foreground text-sm">
            Serial {formatMinutes(metrics.serialMinutes)} → {formatMinutes(metrics.parallelMinutes)}{" "}
            with {metrics.agents} agent{metrics.agents === 1 ? "" : "s"}
          </span>
        </div>
      </Stat>
      <Stat label="Collision score">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`font-heading text-2xl ${collisionsShown > 0 ? "text-fire-red" : "text-emerald-400"}`}
          >
            <Counter value={collisionsShown} />
          </span>
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
            Heatmap
            <Switch
              checked={heatmapOn}
              onCheckedChange={onHeatmap}
              aria-label="Toggle collision heatmap"
            />
          </label>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {collisionsBefore > 0
            ? `${collisionsBefore} proposed overlap${collisionsBefore === 1 ? "" : "s"} repaired`
            : "No overlaps proposed"}
        </p>
      </Stat>
      <Stat label="Est. agent cost">
        <span className="font-heading text-2xl">{formatUsd(metrics.totalCostUsd)}</span>
        <p className="text-muted-foreground mt-1 text-xs">
          {formatTokens(metrics.tokensWithPacks)} tokens · {saved}% saved vs full repo
        </p>
      </Stat>
    </section>
  );
}

function Stat({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-card px-4 py-3 ${wide ? "col-span-2" : ""}`}>
      <div className="font-heading text-muted-foreground mb-1 text-[10px] tracking-widest uppercase">
        {label}
      </div>
      {children}
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
