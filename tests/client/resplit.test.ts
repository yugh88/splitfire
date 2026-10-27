import { describe, expect, it } from "vitest";
import {
  initialResplit,
  previewCollisions,
  previewOwnership,
  resplitReducer,
  resplitView,
} from "@/lib/client/resplit";
import type { Metrics } from "@/lib/plan/events";
import type { Task } from "@/lib/types";

function task(id: string, ownedFiles: string[], extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    goal: `do ${id}`,
    kind: "feature",
    ownedFiles,
    readFiles: [],
    dependsOn: [],
    difficulty: 2,
    model: "small",
    estTokens: 1_000,
    estCostUsd: 0,
    estMinutes: 10,
    acceptance: [],
    ...extra,
  };
}

function metrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    collisionScore: 0,
    serialMinutes: 20,
    parallelMinutes: 20,
    speedup: 1,
    agents: 2,
    tokensFullRepo: 10_000,
    tokensWithPacks: 4_000,
    totalCostUsd: 0,
    criticalPath: ["a"],
    ...overrides,
  };
}

const tasks = () => [
  task("a", ["a1.ts", "a2.ts"], { estMinutes: 20 }),
  task("b", ["b1.ts"], { estMinutes: 5 }),
];

describe("resplitReducer", () => {
  it("moves a file to the target task and keeps the old owner as a reader", () => {
    const state = resplitReducer(initialResplit(tasks()), {
      type: "move",
      file: "a2.ts",
      toTaskId: "b",
    });
    const a = state.tasks.find((t) => t.id === "a")!;
    const b = state.tasks.find((t) => t.id === "b")!;
    expect(a.ownedFiles).toEqual(["a1.ts"]);
    expect(a.readFiles).toEqual(["a2.ts"]);
    expect(b.ownedFiles).toEqual(["b1.ts", "a2.ts"]);
    expect(state.lastMove).toEqual({ file: "a2.ts", from: ["a"], to: "b" });
    expect(state.past).toHaveLength(1);
  });

  it("ignores unknown files and task ids", () => {
    const base = initialResplit(tasks());
    expect(resplitReducer(base, { type: "move", file: "nope.ts", toTaskId: "b" })).toBe(base);
    expect(resplitReducer(base, { type: "move", file: "a1.ts", toTaskId: "nope" })).toBe(base);
  });

  it("undoes one move at a time, back to the original tasks", () => {
    let state = initialResplit(tasks());
    const original = state.tasks;
    state = resplitReducer(state, { type: "move", file: "a1.ts", toTaskId: "b" });
    state = resplitReducer(state, { type: "move", file: "a2.ts", toTaskId: "b" });
    expect(state.past).toHaveLength(2);

    state = resplitReducer(state, { type: "undo" });
    expect(state.tasks.find((t) => t.id === "a")!.ownedFiles).toEqual(["a2.ts"]);
    state = resplitReducer(state, { type: "undo" });
    expect(state.tasks).toBe(original);
    expect(state.tasks).toEqual(tasks());
    expect(state.past).toHaveLength(0);
    expect(resplitReducer(state, { type: "undo" })).toBe(state);
  });

  it("resets to the original plan and clears history", () => {
    let state = initialResplit(tasks());
    state = resplitReducer(state, { type: "move", file: "a1.ts", toTaskId: "b" });
    state = resplitReducer(state, { type: "reset" });
    expect(state.tasks).toBe(state.base);
    expect(state.past).toEqual([]);
    expect(state.lastMove).toBeNull();
  });
});

describe("resplitView", () => {
  it("recomputes collisions, effort, critical path and speedup", () => {
    const state = resplitReducer(initialResplit(tasks()), {
      type: "move",
      file: "a2.ts",
      toTaskId: "b",
    });
    const view = resplitView(state, metrics(), 4);
    expect(view.edited).toBe(true);
    expect(view.collisionScore).toBe(0);
    expect(view.tasks.find((t) => t.id === "a")!.estMinutes).toBe(10);
    expect(view.tasks.find((t) => t.id === "b")!.estMinutes).toBe(10);
    expect(view.metrics.serialMinutes).toBe(20);
    expect(view.metrics.parallelMinutes).toBe(10);
    expect(view.metrics.speedup).not.toBe(metrics().speedup);
    expect(view.criticalPathMinutes).toBeLessThan(20);
  });

  it("leaves metrics alone when nothing moved", () => {
    const state = initialResplit(tasks());
    const view = resplitView(state, metrics(), 4);
    expect(view.edited).toBe(false);
    expect(view.metrics.serialMinutes).toBe(25);
    expect(view.collisionScore).toBe(0);
    expect(view.tasks[0]!.estMinutes).toBe(20);
  });
});

describe("previewOwnership", () => {
  it("shows the overlap a drop would create before it resolves", () => {
    const state = tasks();
    expect(previewCollisions(state, "a1.ts", "b")).toEqual([{ file: "a1.ts", tasks: ["a", "b"] }]);
    expect(previewOwnership(state, "a1.ts", "b").collisionScore).toBe(1);
  });

  it("is clear when the target already owns the file", () => {
    expect(previewCollisions(tasks(), "b1.ts", "b")).toEqual([]);
  });
});
