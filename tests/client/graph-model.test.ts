import { describe, expect, it } from "vitest";
import { graphModel, MERGE_ID, taskLabels, waves } from "@/lib/client/graph-model";
import { initialPlanState, type PlanState } from "@/lib/client/plan-state";
import type { Task } from "@/lib/types";

const task = (id: string, dependsOn: string[] = [], extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  goal: "g",
  kind: "feature",
  ownedFiles: [`${id}.ts`],
  readFiles: [],
  dependsOn,
  difficulty: 1,
  model: "m",
  estTokens: 1,
  estCostUsd: 0,
  estMinutes: 10,
  acceptance: [],
  ...extra,
});

const state: PlanState = {
  ...initialPlanState,
  stage: "done",
  partitioned: {
    tasks: [task("b", ["a"]), task("a", [], { kind: "contract", difficulty: 3 }), task("c", ["a"])],
    draft: [],
    collisions: [],
    collisionScoreBefore: 0,
    collisionScore: 0,
    repairs: [],
  },
  metrics: {
    collisionScore: 0,
    serialMinutes: 30,
    parallelMinutes: 20,
    speedup: 1.5,
    agents: 2,
    tokensFullRepo: 0,
    tokensWithPacks: 0,
    totalCostUsd: 0,
    criticalPath: ["a", "b"],
  },
};

describe("waves / taskLabels", () => {
  it("groups tasks by dependency depth and labels them wave by wave", () => {
    const tasks = [task("c", ["b"]), task("b", ["a"]), task("a"), task("d")];
    expect(waves(tasks).map((w) => w.ids)).toEqual([["a", "d"], ["b"], ["c"]]);
    expect([...taskLabels(tasks)]).toEqual([
      ["a", "T0"],
      ["d", "T1"],
      ["b", "T2"],
      ["c", "T3"],
    ]);
  });

  it("tolerates cycles without looping", () => {
    expect(
      waves([task("a", ["b"]), task("b", ["a"])])
        .flatMap((w) => w.ids)
        .sort(),
    ).toEqual(["a", "b"]);
  });
});

describe("graphModel", () => {
  it("builds labelled nodes with model tier and wave", () => {
    const { nodes } = graphModel(state);
    expect(nodes.find((n) => n.id === "a")).toMatchObject({
      label: "T0",
      tier: "strong",
      wave: 0,
      critical: true,
    });
    expect(nodes.find((n) => n.id === "c")).toMatchObject({
      label: "T2",
      tier: "fast",
      wave: 1,
      critical: false,
    });
  });

  it("marks critical edges and joins sink tasks into the merge node", () => {
    const { edges, merge } = graphModel(state);
    expect(merge).toBe(true);
    expect(edges).toEqual([
      { id: "d:a>b", source: "a", target: "b", critical: true },
      { id: "d:a>c", source: "a", target: "c", critical: false },
      { id: `m:b`, source: "b", target: MERGE_ID, critical: true },
      { id: `m:c`, source: "c", target: MERGE_ID, critical: false },
    ]);
  });

  it("renders streamed proposals before partitioning, without a merge node", () => {
    const streaming: PlanState = {
      ...initialPlanState,
      stage: "planning",
      proposals: [
        {
          id: "p",
          title: "P",
          goal: "g",
          kind: "test",
          ownedFiles: ["x"],
          dependsOn: [],
          difficulty: 2,
        },
      ],
    };
    const model = graphModel(streaming);
    expect(model.merge).toBe(false);
    expect(model.nodes[0]).toMatchObject({ id: "p", final: false, estMinutes: null });
  });
});
