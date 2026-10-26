"use client";

import { AlertTriangle, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TaskGraph } from "@/components/graph/task-graph";
import { HeatmapView } from "@/components/heatmap-view";
import { Logo } from "@/components/logo";
import { MetricCards } from "@/components/metric-cards";
import { ProgressSteps } from "@/components/progress-steps";
import { TaskCard } from "@/components/task-card";
import { WaveList } from "@/components/wave-list";
import { useMediaQuery } from "@/hooks/use-media-query";
import { type GraphModel, graphModel, taskLabels } from "@/lib/client/graph-model";
import type { PlanState } from "@/lib/client/plan-state";
import { formatMinutes, plural } from "@/lib/format";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PLANNER_LABEL = {
  llm: "Planned by open model",
  fallback: "Planned by fallback model",
  deterministic: "Deterministic plan",
  mock: "Mock plan (MOCK_LLM)",
} as const;

type Props = {
  state: PlanState;
  repo: string;
  request: string;
  agents: number;
  actions?: React.ReactNode;
};

/** The plan page: header, metrics, graph/heatmap tabs and the selected task. */
export function PlanScreen({ state, repo, request, agents, actions }: Props) {
  const wide = useMediaQuery("(min-width: 640px)");
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = useState<"graph" | "heatmap">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const [lit, setLit] = useState<Set<string>>(new Set());
  const model = useMemo(() => graphModel(state), [state]);
  const tasks = state.partitioned?.tasks;
  const labels = useMemo(() => taskLabels(tasks ?? state.proposals), [tasks, state.proposals]);

  useEffect(() => {
    setLit(new Set());
    if (state.stage !== "done") return;
    const order = model.waves.flatMap((w) => w.ids);
    const timers = order.map((id, i) =>
      setTimeout(() => setLit((prev) => new Set(prev).add(id)), 250 + i * 160),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.stage, model.waves]);

  const done =
    state.stage === "done" && state.metrics && state.partitioned
      ? { metrics: state.metrics, partitioned: state.partitioned, tasks: state.partitioned.tasks }
      : null;
  const task = tasks?.find((t) => t.id === selected) ?? null;
  const sha = state.ingested?.sha ?? state.report?.plan.sha;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-24 sm:px-6">
      <header className="border-border flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-4">
        <Logo />
        <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
          <div className="text-muted-foreground truncate font-mono text-xs">
            {state.ingested?.repo ?? repo}
            {sha ? ` @ ${sha.slice(0, 7)}` : ""}
          </div>
          <div className="text-sm font-semibold sm:truncate sm:text-base" title={request}>
            {request}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 sm:ml-0">{actions}</div>
      </header>

      {state.stage !== "done" && (
        <div className="py-4">
          <ProgressSteps state={state} />
        </div>
      )}

      {state.report?.notice && (
        <div
          role="status"
          className="border-fire-amber/40 bg-fire-amber/10 mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertTriangle className="text-fire-amber size-4 shrink-0" />
          {state.report.notice === "demo budget reached"
            ? "Demo budget reached — this plan was built by the deterministic planner."
            : `Note: ${state.report.notice}. This plan was built by the deterministic planner.`}
        </div>
      )}

      {done && (
        <div className="mt-4">
          <MetricCards
            compact={!wide}
            metrics={done.metrics}
            tasks={done.tasks}
            waves={model.waves}
            collisionsBefore={done.partitioned.collisionScoreBefore}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="border-border bg-card/60 min-w-0 rounded-xl border">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
            <div
              role="tablist"
              className="border-border bg-background/50 flex rounded-lg border p-1"
            >
              {(["graph", "heatmap"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  disabled={t === "heatmap" && !done}
                  onClick={() => setTab(t)}
                  className={cn(
                    "font-heading rounded-md px-4 py-1.5 text-xs tracking-widest uppercase disabled:opacity-40",
                    tab === t ? "bg-accent text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <Legend />
          </div>

          {tab === "heatmap" && done ? (
            <HeatmapView
              partitioned={done.partitioned}
              metrics={done.metrics}
              waves={model.waves}
              labels={labels}
            />
          ) : (
            <>
              {wide ? (
                <div className="relative h-[620px]">
                  {model.nodes.length > 0 ? (
                    <TaskGraph
                      model={model}
                      agents={agents}
                      lit={lit}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  ) : (
                    <Waiting />
                  )}
                  {state.report && (
                    <span className="bg-background/80 text-muted-foreground absolute top-3 right-3 rounded-md px-2 py-1 text-[11px]">
                      {PLANNER_LABEL[state.report.planner]}
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-3">
                  {done ? (
                    <WaveList
                      tasks={done.tasks}
                      waves={model.waves}
                      labels={labels}
                      agents={agents}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  ) : (
                    <Waiting count={state.proposals.length} />
                  )}
                </div>
              )}
              {done && (
                <ContractsCallout
                  tasks={done.tasks}
                  model={model}
                  labels={labels}
                  agents={done.metrics.agents}
                />
              )}
            </>
          )}
        </section>

        {wide && (desktop || task) && (
          <aside>
            {task ? (
              <TaskCard task={task} labels={labels} onClose={() => setSelected(null)} />
            ) : (
              <div className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                {done
                  ? "Select a task to see its files, model, cost and checks."
                  : "Tasks appear in the graph as the planner streams them."}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Contract", className: "bg-contract-blue" },
    { label: "Feature", className: "bg-fire-amber" },
    { label: "Test", className: "bg-ok-green" },
  ];
  return (
    <div className="text-muted-foreground hidden items-center gap-4 text-xs md:flex">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", i.className)} />
          {i.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="border-fire-orange w-4 border-t-2 border-dashed" />
        Critical path
      </span>
    </div>
  );
}

function Waiting({ count = 0 }: { count?: number }) {
  return (
    <div className="text-muted-foreground flex h-full min-h-40 items-center justify-center text-sm">
      {count > 0 ? `${plural(count, "task")} proposed…` : "Waiting for the first task…"}
    </div>
  );
}

function ContractsCallout(props: {
  tasks: Task[];
  model: GraphModel;
  labels: Map<string, string>;
  agents: number;
}) {
  const [first, second] = props.model.waves;
  const firstTasks = (first?.ids ?? []).map((id) => props.tasks.find((t) => t.id === id));
  const contracts = firstTasks.filter((t): t is Task => t?.kind === "contract");
  const fanOut = second && second.ids.length > 1;
  const text =
    contracts.length > 0 && fanOut
      ? `Contracts-first: ${contracts.map((t) => props.labels.get(t.id)).join(", ")} lands shared types in ${formatMinutes(Math.max(...contracts.map((t) => t.estMinutes)))}, so ${plural(Math.min(second.ids.length, props.agents), "agent")} start wave 2 together instead of waiting in a chain.`
      : `${plural(props.model.waves.length, "wave")} · up to ${plural(props.agents, "agent")} at a time, each on files no one else touches.`;
  return (
    <p className="border-border bg-background/50 m-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
      <Zap className="text-contract-blue mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}
