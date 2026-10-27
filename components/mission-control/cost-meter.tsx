"use client";

import { Info } from "lucide-react";
import type { PlannerKind } from "@/lib/plan/events";
import { cn } from "@/lib/utils";

export type CostMeterInput = {
  agents: number;
  speedup: number;
  totalCostUsd: number;
  planner: PlannerKind;
};

/** "4 agents · 2.7× faster · ~$0.03 planning cost", or the offline planner variant. */
export function costMeterLabel({ agents, speedup, totalCostUsd, planner }: CostMeterInput): string {
  const run = `${agents} agent${agents === 1 ? "" : "s"} · ${speedup}× faster`;
  if (planner === "deterministic") return `${run} · $0.00 · offline planner`;
  if (planner === "mock") return `${run} · $0.00 · mock planner`;
  return `${run} · ${estimatedCost(totalCostUsd)} planning cost`;
}

/** Cost as the meter reads it: cents for normal plans, three decimals for tiny ones. */
export function estimatedCost(usd: number): string {
  if (!(usd > 0)) return "$0.00";
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `~$${usd.toFixed(3)}`;
  return `~$${usd.toFixed(2)}`;
}

type Props = CostMeterInput & { className?: string };

/** Live summary line: agents, speedup and the plan's estimated model spend. */
export function CostMeter({ agents, speedup, totalCostUsd, planner, className }: Props) {
  return (
    <span
      className={cn(
        "text-muted-foreground inline-flex min-w-0 items-center gap-1.5 font-mono text-xs",
        className,
      )}
    >
      <span aria-live="polite" className="min-w-0">
        {costMeterLabel({ agents, speedup, totalCostUsd, planner })}
      </span>
      <span className="relative inline-flex">
        <button
          type="button"
          aria-describedby="cost-meter-help"
          className="peer text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Info className="size-3.5" aria-hidden />
          <span className="sr-only">How planning cost is estimated</span>
        </button>
        <span
          id="cost-meter-help"
          role="tooltip"
          className="border-border bg-popover text-popover-foreground pointer-events-none absolute top-full right-0 z-30 mt-2 hidden w-[min(16rem,calc(100vw-2rem))] rounded-xl border px-3 py-2 text-left font-sans text-xs leading-relaxed shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.04)] peer-hover:block peer-focus:block"
        >
          Estimated from each task&apos;s model and token count, priced with{" "}
          <code className="font-mono">MODEL_PRICES_JSON</code> (USD per 1M tokens). Deterministic
          and mock plans make no model calls, so they read $0.00.
        </span>
      </span>
    </span>
  );
}
