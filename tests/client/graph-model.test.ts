import { describe, expect, it } from "vitest";
import { graphModel, litOrder } from "@/lib/client/graph-model";
import { initialPlanState, type PlanState } from "@/lib/client/plan-state";
import type { Task } from "@/lib/types";

const task = (id: string, dependsOn: string[] = []): Task => ({
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
});

const state: PlanState = {
  ...initialPlanState,
  stage: "done",
  partitioned: {
    tasks: [task("a"), task("b", ["a"]), task("c", ["a"])],
    collisions: [{ file: "shared.ts", tasks: ["b", "c"] }],
    collisionScoreBefore: 1,
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

describe("graphModel", () => {
  it("marks critical edges and nodes", () => {
    const { nodes, edges } = graphModel(state, "off");
    expect(nodes.find((n) => n.id === "b")?.critical).toBe(true);
    expect(nodes.find((n) => n.id === "c")?.critical).toBe(false);
    expect(edges).toEqual([
      { id: "d:a>b", source: "a", target: "b", kind: "critical" },
      { id: "d:a>c", source: "a", target: "c", kind: "dep" },
    ]);
  });

  it("shows proposed collisions only in the proposed heatmap", () => {
    const proposed = graphModel(state, "proposed");
    expect(proposed.nodes.map((n) => n.heat)).toEqual([0, 1, 1]);
    expect(proposed.edges.filter((e) => e.kind === "collision")).toHaveLength(1);
    const repaired = graphModel(state, "repaired");
    expect(repaired.nodes.every((n) => n.heat === 0)).toBe(true);
  });

  it("renders streamed proposals before partitioning", () => {
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
    expect(graphModel(streaming, "off").nodes[0]).toMatchObject({
      id: "p",
      final: false,
      estMinutes: null,
    });
  });
});

describe("litOrder", () => {
  it("orders roots first, then by depth", () => {
    expect(litOrder([task("c", ["b"]), task("b", ["a"]), task("a"), task("d")])).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });
});
