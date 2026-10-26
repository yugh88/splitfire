import { Check, Loader2 } from "lucide-react";
import type { PlanState, Stage } from "@/lib/client/plan-state";
import { cn } from "@/lib/utils";

const STEPS: { stage: Stage; label: string }[] = [
  { stage: "ingesting", label: "Fetch repo" },
  { stage: "planning", label: "Plan tasks" },
  { stage: "partitioning", label: "Partition" },
  { stage: "done", label: "Done" },
];

export function ProgressSteps({ state }: { state: PlanState }) {
  const current = STEPS.findIndex((s) => s.stage === state.stage);
  const detail: Record<string, string | null> = {
    ingesting: state.ingested
      ? `${state.ingested.files} files${state.ingested.cacheHit ? " · cached" : ""}`
      : null,
    planning: state.graph ? `${state.graph.edges} imports · ${state.proposals.length} tasks` : null,
    partitioning: state.partitioned ? `${state.partitioned.repairs.length} repairs` : null,
    done: null,
  };
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Progress">
      {STEPS.map((step, i) => {
        const done = i < current || state.stage === "done";
        const active = i === current && state.stage !== "done";
        return (
          <li
            key={step.stage}
            className={cn("flex items-center gap-1.5", !done && !active && "opacity-40")}
          >
            {done ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : active ? (
              <Loader2 className="text-primary size-3.5 animate-spin" />
            ) : (
              <span className="border-muted-foreground size-3.5 rounded-full border" />
            )}
            <span className="font-medium">{step.label}</span>
            {detail[step.stage] && (
              <span className="text-muted-foreground">{detail[step.stage]}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
