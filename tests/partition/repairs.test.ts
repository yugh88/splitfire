import { describe, expect, it } from "vitest";
import { describeRepair } from "@/lib/partition/repairs";

describe("describeRepair", () => {
  it("relabels task ids but never touches file paths", () => {
    const label = (id: string) => ({ src: "T0", ui: "T1" })[id] ?? id;
    expect(
      describeRepair({ kind: "owner", file: "src/index.ts", winner: "src", loser: "ui" }, label),
    ).toBe("Gave src/index.ts to T0 only; T1 reads it from its context pack.");
    expect(describeRepair({ kind: "cycle", task: "ui", dep: "src" }, label)).toBe(
      "Broke a cycle: T1 no longer waits for T0.",
    );
    expect(describeRepair({ kind: "unknown-dep", task: "ui", dep: "ghost" })).toBe(
      "Removed ui's dependency on unknown task ghost.",
    );
  });
});

describe("describeRepair (contracts)", () => {
  it("explains contract moves and fan-outs", () => {
    const label = (id: string) => ({ contracts: "T0", store: "T1", form: "T2" })[id] ?? id;
    expect(
      describeRepair(
        { kind: "contract", task: "contracts", files: ["src/types.ts"], from: ["store"] },
        label,
      ),
    ).toBe("Moved src/types.ts into a new contract task T0 (was owned by T1).");
    expect(
      describeRepair({ kind: "fan-out", task: "form", dep: "store", via: "contracts" }, label),
    ).toBe("T2 now waits only for contract T0, not for T1, so they run in parallel.");
  });
});
