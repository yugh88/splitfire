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
