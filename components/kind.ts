import type { Task } from "@/lib/types";

/** Kind colors from the design: contract blue, feature amber, test green, docs slate. */
export const KIND = {
  contract: {
    text: "text-contract-blue",
    border: "border-contract-blue/60",
    bg: "bg-contract-blue/10",
    dot: "bg-contract-blue",
  },
  feature: {
    text: "text-fire-amber",
    border: "border-fire-amber/60",
    bg: "bg-fire-amber/10",
    dot: "bg-fire-amber",
  },
  test: {
    text: "text-ok-green",
    border: "border-ok-green/60",
    bg: "bg-ok-green/10",
    dot: "bg-ok-green",
  },
  docs: {
    text: "text-slate-300",
    border: "border-slate-400/50",
    bg: "bg-slate-400/10",
    dot: "bg-slate-300",
  },
} satisfies Record<Task["kind"], Record<"text" | "border" | "bg" | "dot", string>>;
