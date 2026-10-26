import type { Metrics, PlanEvent, PlanEventData, PlanReport } from "@/lib/plan/events";
import type { TaskProposal } from "@/lib/plan/schema";

export type Stage = "idle" | "ingesting" | "planning" | "partitioning" | "done" | "error";

export type PlanState = {
  stage: Stage;
  ingested: PlanEventData<"ingested"> | null;
  graph: { files: number; edges: number; parser: string } | null;
  attempt: number;
  proposals: TaskProposal[];
  partitioned: PlanEventData<"partitioned"> | null;
  metrics: Metrics | null;
  report: PlanReport | null;
  error: PlanEventData<"error"> | null;
};

export type PlanAction =
  | { type: "start" }
  | { type: "reset" }
  | { type: "event"; event: PlanEvent }
  | { type: "fail"; message: string };

export const initialPlanState: PlanState = {
  stage: "idle",
  ingested: null,
  graph: null,
  attempt: 0,
  proposals: [],
  partitioned: null,
  metrics: null,
  report: null,
  error: null,
};

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  if (action.type === "start") return { ...initialPlanState, stage: "ingesting" };
  if (action.type === "reset") return initialPlanState;
  if (action.type === "fail") {
    return { ...state, stage: "error", error: { code: "network", message: action.message } };
  }
  const { event } = action;
  switch (event.type) {
    case "ingested":
      return { ...state, ingested: event.data };
    case "graph":
      return {
        ...state,
        stage: "planning",
        graph: {
          files: event.data.files.length,
          edges: event.data.edges.length,
          parser: event.data.parser,
        },
      };
    case "task": {
      const { attempt, task } = event.data;
      if (attempt < state.attempt) return state;
      const base = attempt > state.attempt ? [] : state.proposals.filter((p) => p.id !== task.id);
      return { ...state, attempt, proposals: [...base, task] };
    }
    case "partitioned":
      return { ...state, stage: "partitioning", partitioned: event.data };
    case "metrics":
      return { ...state, metrics: event.data };
    case "done":
      return { ...state, stage: "done", report: event.data };
    case "error":
      return { ...state, stage: "error", error: event.data };
  }
}

/** A finished state built from a stored plan (share pages). */
export function stateFromReport(report: PlanReport): PlanState {
  const { plan } = report;
  return {
    ...initialPlanState,
    stage: "done",
    proposals: [],
    partitioned: {
      tasks: plan.tasks,
      draft: report.draft,
      collisions: report.collisions,
      collisionScoreBefore: report.collisionScoreBefore,
      collisionScore: plan.collisionScore,
      repairs: report.repairs,
    },
    metrics: {
      collisionScore: plan.collisionScore,
      serialMinutes: plan.serialMinutes,
      parallelMinutes: plan.parallelMinutes,
      speedup: plan.speedup,
      agents: plan.agents,
      tokensFullRepo: plan.tokensFullRepo,
      tokensWithPacks: plan.tokensWithPacks,
      totalCostUsd: plan.totalCostUsd,
      criticalPath: report.criticalPath,
    },
    report,
  };
}
