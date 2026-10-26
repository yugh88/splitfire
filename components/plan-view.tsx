"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TaskGraph } from "@/components/graph/task-graph";
import { MetricsBar } from "@/components/metrics-bar";
import { TaskCard } from "@/components/task-card";
import { graphModel, litOrder } from "@/lib/client/graph-model";
import type { PlanState } from "@/lib/client/plan-state";

type Heatmap = "off" | "proposed" | "repaired";

const PLANNER_LABEL = {
  llm: "Planned by open model",
  fallback: "Planned by fallback model",
  deterministic: "Deterministic plan",
  mock: "Mock plan (MOCK_LLM)",
} as const;

/** Metrics, task graph and task details for a live or stored plan. */
export function PlanView({ state }: { state: PlanState }) {
  const [heatmap, setHeatmap] = useState<Heatmap>("off");
  const [selected, setSelected] = useState<string | null>(null);
  const [lit, setLit] = useState<Set<string>>(new Set());
  const model = useMemo(() => graphModel(state, heatmap), [state, heatmap]);

  useEffect(() => {
    if (heatmap !== "proposed") return;
    const timer = setTimeout(() => setHeatmap("repaired"), 1_800);
    return () => clearTimeout(timer);
  }, [heatmap]);

  const tasks = state.partitioned?.tasks;
  useEffect(() => {
    setLit(new Set());
    if (state.stage !== "done" || !tasks) return;
    const timers = litOrder(tasks).map((id, i) =>
      setTimeout(() => setLit((prev) => new Set(prev).add(id)), 200 + i * 160),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.stage, tasks]);

  const task = tasks?.find((t) => t.id === selected) ?? null;
  const p = state.partitioned;
  const report = state.report;

  return (
    <div className="space-y-4">
      {report?.notice && (
        <div
          role="status"
          className="border-fire-amber/40 bg-fire-amber/10 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertTriangle className="text-fire-amber size-4" />
          {report.notice === "demo budget reached"
            ? "Demo budget reached — this plan was built by the deterministic planner."
            : `Note: ${report.notice}. This plan was built by the deterministic planner.`}
        </div>
      )}
      {state.metrics && p && (
        <MetricsBar
          metrics={state.metrics}
          collisionsShown={heatmap === "proposed" ? p.collisionScoreBefore : p.collisionScore}
          collisionsBefore={p.collisionScoreBefore}
          heatmapOn={heatmap !== "off"}
          onHeatmap={(on) => setHeatmap(on ? "proposed" : "off")}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="border-border bg-card/40 relative h-[60vh] min-h-[360px] overflow-hidden rounded-xl border lg:h-[640px]">
          {model.nodes.length > 0 ? (
            <TaskGraph model={model} lit={lit} selected={selected} onSelect={setSelected} />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Waiting for the first task…
            </div>
          )}
          {report && (
            <span className="bg-background/80 text-muted-foreground absolute top-3 left-3 rounded-md px-2 py-1 text-[11px]">
              {PLANNER_LABEL[report.planner]} · {report.plan.tasks.length} tasks
            </span>
          )}
        </div>
        <aside className="space-y-3">
          {task && p ? (
            <TaskCard
              task={task}
              collisions={p.collisions}
              repairs={p.repairs}
              onClose={() => setSelected(null)}
            />
          ) : (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
              {tasks
                ? "Select a task to see its files, model, cost and checks."
                : "Tasks appear here as the planner streams them."}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
