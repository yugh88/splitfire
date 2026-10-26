import { describe, expect, it } from "vitest";
import { checkCall, modelForSpend, recordSpend, totalSpend } from "@/lib/plan/budget";
import { memory } from "@/lib/store/kv";
import { testConfig } from "../helpers/plan";

const cfg = testConfig();
const call = {
  model: "big",
  inputTokens: 5_000,
  maxOutputTokens: 4_000,
  planSpentUsd: 0,
  totalSpentUsd: 0,
};

describe("modelForSpend", () => {
  it("uses the planner model, then the fast model at 90%, then nothing at 100%", () => {
    expect(modelForSpend(0, cfg)).toBe("big");
    expect(modelForSpend(4.49, cfg)).toBe("big");
    expect(modelForSpend(4.5, cfg)).toBe("small");
    expect(modelForSpend(5, cfg)).toBeNull();
  });
});

describe("checkCall", () => {
  it("allows a call within both caps and returns its worst-case cost", () => {
    // 5k in * $1/M + 4k out * $4/M = $0.021
    expect(checkCall(call, cfg)).toEqual({ ok: true, estimateUsd: 0.021 });
  });

  it("blocks calls that would exceed the per-plan cap", () => {
    expect(checkCall({ ...call, planSpentUsd: 0.04 }, cfg)).toEqual({
      ok: false,
      reason: "plan_cap",
    });
  });

  it("blocks calls that would exceed the total budget", () => {
    expect(checkCall({ ...call, totalSpentUsd: 4.99 }, cfg)).toEqual({
      ok: false,
      reason: "budget_exhausted",
    });
  });

  it("blocks models without a known price", () => {
    expect(checkCall({ ...call, model: "mystery" }, cfg)).toEqual({
      ok: false,
      reason: "no_price",
    });
  });
});

describe("recordSpend", () => {
  it("increments total and daily counters", async () => {
    const store = memory();
    const now = new Date("2026-10-26T10:00:00Z");
    await recordSpend(store, 0.01, now);
    expect(await recordSpend(store, 0.02, now)).toBeCloseTo(0.03);
    expect(await totalSpend(store)).toBeCloseTo(0.03);
    expect(await store.get<number>("spend:day:2026-10-26")).toBeCloseTo(0.03);
  });

  it("ignores zero spend", async () => {
    const store = memory();
    await recordSpend(store, 0);
    expect(await store.get("spend:total")).toBeNull();
  });
});
