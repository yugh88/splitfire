import { describe, expect, it } from "vitest";
import { costMeterLabel, estimatedCost } from "@/components/mission-control/cost-meter";

describe("estimatedCost", () => {
  it("reads cents for normal plans and three decimals for tiny ones", () => {
    expect(estimatedCost(0)).toBe("$0.00");
    expect(estimatedCost(0.0004)).toBe("<$0.001");
    expect(estimatedCost(0.0032)).toBe("~$0.003");
    expect(estimatedCost(0.031)).toBe("~$0.03");
    expect(estimatedCost(1.234)).toBe("~$1.23");
  });
});

describe("costMeterLabel", () => {
  it("puts agents, speedup and estimated planning cost on one line", () => {
    expect(costMeterLabel({ agents: 4, speedup: 2.7, totalCostUsd: 0.031, planner: "llm" })).toBe(
      "4 agents · 2.7× faster · ~$0.03 planning cost",
    );
  });

  it("reads $0.00 for planners that make no model calls", () => {
    expect(
      costMeterLabel({ agents: 4, speedup: 2.7, totalCostUsd: 0.031, planner: "deterministic" }),
    ).toBe("4 agents · 2.7× faster · $0.00 · offline planner");
    expect(costMeterLabel({ agents: 2, speedup: 1.4, totalCostUsd: 0, planner: "mock" })).toBe(
      "2 agents · 1.4× faster · $0.00 · mock planner",
    );
  });

  it("keeps the fallback model as a paid plan", () => {
    expect(
      costMeterLabel({ agents: 2, speedup: 1.9, totalCostUsd: 0.0032, planner: "fallback" }),
    ).toBe("2 agents · 1.9× faster · ~$0.003 planning cost");
  });
});
