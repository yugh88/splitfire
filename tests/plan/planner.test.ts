import { describe, expect, it } from "vitest";
import type { LlmCall, LlmResult } from "@/lib/plan/llm";
import { BUDGET_NOTICE, NO_MODEL_NOTICE, proposeTasks } from "@/lib/plan/planner";
import { memory } from "@/lib/store/kv";
import { fixtureAnalysis, proposal, testConfig } from "../helpers/plan";

const good = [
  proposal("types", ["src/types.ts"]),
  proposal("ui", ["src/components/App.tsx"], ["types"]),
];
const usage = { inputTokens: 1_000, outputTokens: 500 };

function scripted(results: LlmResult[]) {
  const seen: LlmCall[] = [];
  const callModel = async (call: LlmCall): Promise<LlmResult> => {
    seen.push(call);
    const next = results[seen.length - 1] ?? { ok: false, error: "no more", usage };
    if (next.ok) next.tasks.forEach(call.onTask);
    return next;
  };
  return { callModel, seen };
}

async function run(results: LlmResult[], cfg = testConfig(), store = memory()) {
  const streamed: { id: string; attempt: number }[] = [];
  const { callModel, seen } = scripted(results);
  const result = await proposeTasks(await fixtureAnalysis(), "add user greeting", {
    cfg,
    store,
    callModel,
    onTask: (t, attempt) => streamed.push({ id: t.id, attempt }),
  });
  return { result, seen, streamed, store };
}

describe("proposeTasks", () => {
  it("returns the model's plan when it validates first time", async () => {
    const { result, seen, streamed, store } = await run([{ ok: true, tasks: good, usage }]);
    expect(result.planner).toBe("llm");
    expect(result.proposals).toEqual(good);
    expect(seen.map((c) => c.model)).toEqual(["big"]);
    expect(streamed).toEqual([
      { id: "types", attempt: 1 },
      { id: "ui", attempt: 1 },
    ]);
    // $1/M * 1000 + $4/M * 500 = $0.003, recorded after the call
    expect(await store.get<number>("spend:total")).toBeCloseTo(0.003);
  });

  it("retries once with the validation error attached", async () => {
    const { result, seen } = await run([
      { ok: false, error: "ownedFiles: too small", usage },
      { ok: true, tasks: good, usage },
    ]);
    expect(result.planner).toBe("llm");
    expect(seen[1]!.prompt).toContain("Your previous answer was rejected: ownedFiles: too small");
  });

  it("treats a dependency cycle as invalid", async () => {
    const cyclic = [proposal("a", ["x.ts"], ["b"]), proposal("b", ["y.ts"], ["a"])];
    const { result, seen } = await run([
      { ok: true, tasks: cyclic, usage },
      { ok: true, tasks: good, usage },
    ]);
    expect(seen[1]!.prompt).toContain("cycle");
    expect(result.proposals).toEqual(good);
  });

  it("moves to the fallback model, then to the deterministic plan", async () => {
    const fail: LlmResult = { ok: false, error: "bad json", usage: null };
    const cfg = testConfig({ planMaxCostUsd: 0.5 });
    const viaFallback = await run([fail, fail, { ok: true, tasks: good, usage }], cfg);
    expect(viaFallback.result.planner).toBe("fallback");
    expect(viaFallback.seen.map((c) => c.model)).toEqual(["big", "big", "backup"]);

    const allFail = await run([fail, fail, fail], cfg);
    expect(allFail.result.planner).toBe("deterministic");
    expect(allFail.result.proposals.length).toBeGreaterThan(0);
    expect(allFail.result.calls).toHaveLength(3);
  });

  it("does not call the model once the budget is used up", async () => {
    const store = memory();
    await store.incrBy("spend:total", 5);
    const { result, seen } = await run([{ ok: true, tasks: good, usage }], testConfig(), store);
    expect(seen).toHaveLength(0);
    expect(result).toMatchObject({ planner: "deterministic", notice: BUDGET_NOTICE });
  });

  it("switches to the fast model at 90% and skips the fallback endpoint", async () => {
    const store = memory();
    await store.incrBy("spend:total", 4.6);
    const fail: LlmResult = { ok: false, error: "x", usage };
    const { seen } = await run([fail, fail, fail], testConfig(), store);
    expect(seen.map((c) => c.model)).toEqual(["small", "small"]);
  });

  it("blocks a call that would break the per-plan cap", async () => {
    const { result, seen } = await run([], testConfig({ planMaxCostUsd: 0.0001 }));
    expect(seen).toHaveLength(0);
    expect(result.notice).toBe(BUDGET_NOTICE);
  });

  it("says no model is configured (not budget) when env has no endpoint", async () => {
    const { result, seen } = await run(
      [],
      testConfig({ primary: null, fallback: null, plannerModel: "" }),
    );
    expect(seen).toHaveLength(0);
    expect(result).toMatchObject({ planner: "deterministic", notice: NO_MODEL_NOTICE });
  });

  it("uses the mock planner without any model call in MOCK_LLM mode", async () => {
    const analysis = await fixtureAnalysis();
    const streamed: string[] = [];
    const result = await proposeTasks(analysis, "add user greeting", {
      cfg: testConfig({ mockLlm: true }),
      store: memory(),
      delayMs: 0,
      callModel: () => Promise.reject(new Error("must not be called")),
      onTask: (t) => streamed.push(t.id),
    });
    expect(result.planner).toBe("mock");
    expect(streamed).toEqual(result.proposals.map((p) => p.id));
  });
});
