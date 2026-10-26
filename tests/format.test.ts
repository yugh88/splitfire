import { describe, expect, it } from "vitest";
import { formatMinutes, formatTokens, formatUsd, percentSaved, speedupLine } from "@/lib/format";

describe("format", () => {
  it("formats minutes as m or h", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(90)).toBe("1.5h");
    expect(formatMinutes(360)).toBe("6h");
  });

  it("formats the speedup line from the spec", () => {
    expect(speedupLine({ serialMinutes: 360, parallelMinutes: 90, agents: 4, speedup: 4 })).toBe(
      "Serial 6h → 1.5h with 4 agents (4×)",
    );
  });

  it("formats money and tokens", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(0.004)).toBe("<$0.01");
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(12_340)).toBe("12.3k");
    expect(formatTokens(2_500_000)).toBe("2.5M");
    expect(percentSaved(1000, 100)).toBe(90);
    expect(percentSaved(0, 10)).toBe(0);
  });
});
