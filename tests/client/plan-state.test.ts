import { describe, expect, it } from "vitest";
import {
  initialPlanState,
  planReducer,
  stateFromReport,
  type PlanState,
} from "@/lib/client/plan-state";
import type { PlanEvent, PlanReport } from "@/lib/plan/events";
import { proposal } from "../helpers/plan";

const apply = (
  events: PlanEvent[],
  state: PlanState = planReducer(initialPlanState, { type: "start" }),
) => events.reduce((s, event) => planReducer(s, { type: "event", event }), state);

describe("planReducer", () => {
  it("moves through stages as events arrive", () => {
    const s = apply([
      {
        type: "ingested",
        data: { repo: "a/b", sha: "s", files: 3, skipped: 0, truncated: false, cacheHit: false },
      },
      { type: "graph", data: { files: [], edges: [], parser: "tree-sitter" } },
    ]);
    expect(s.stage).toBe("planning");
    expect(s.ingested?.files).toBe(3);
  });

  it("restarts the proposal list when a retry attempt begins", () => {
    const s = apply([
      { type: "task", data: { attempt: 1, task: proposal("a", ["x"]) } },
      { type: "task", data: { attempt: 1, task: proposal("b", ["y"]) } },
      { type: "task", data: { attempt: 2, task: proposal("c", ["z"]) } },
      { type: "task", data: { attempt: 1, task: proposal("late", ["w"]) } },
    ]);
    expect(s.attempt).toBe(2);
    expect(s.proposals.map((p) => p.id)).toEqual(["c"]);
  });

  it("records errors from the stream and from the network", () => {
    expect(
      apply([{ type: "error", data: { code: "rate_limited", message: "slow down" } }]).error,
    ).toEqual({
      code: "rate_limited",
      message: "slow down",
    });
    const failed = planReducer(initialPlanState, { type: "fail", message: "offline" });
    expect(failed).toMatchObject({
      stage: "error",
      error: { code: "network", message: "offline" },
    });
  });
});

describe("stateFromReport", () => {
  it("rebuilds a finished state from a stored plan", () => {
    const report: PlanReport = {
      plan: {
        id: "p",
        repo: "a/b",
        sha: "s",
        request: "r",
        tasks: [],
        collisionScore: 0,
        serialMinutes: 60,
        parallelMinutes: 30,
        speedup: 2,
        agents: 2,
        tokensFullRepo: 100,
        tokensWithPacks: 10,
        totalCostUsd: 0.1,
      },
      planner: "llm",
      notice: null,
      collisions: [{ file: "x", tasks: ["a", "b"] }],
      collisionScoreBefore: 1,
      repairs: [],
      criticalPath: ["a"],
    };
    const s = stateFromReport(report);
    expect(s.stage).toBe("done");
    expect(s.partitioned?.collisionScoreBefore).toBe(1);
    expect(s.metrics?.speedup).toBe(2);
  });
});
