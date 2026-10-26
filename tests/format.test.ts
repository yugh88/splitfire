import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  formatTokens,
  formatUsd,
  percentSaved,
  plural,
  shortPath,
  speedupLine,
} from "@/lib/format";

describe("format", () => {
  it("formats minutes like the design", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(245)).toBe("4h 05m");
    expect(formatMinutes(360)).toBe("6h");
  });

  it("formats the speedup line", () => {
    expect(speedupLine({ serialMinutes: 360, parallelMinutes: 90, agents: 4, speedup: 4 })).toBe(
      "Serial 6h → 1h 30m with 4 agents (4×)",
    );
  });

  it("formats money, tokens and plurals", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(0.0004)).toBe("<$0.001");
    expect(formatUsd(0.031)).toBe("$0.031");
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(412_000)).toBe("412k");
    expect(formatTokens(2_500_000)).toBe("2.5M");
    expect(percentSaved(1000, 130)).toBe(87);
    expect(percentSaved(0, 10)).toBe(0);
    expect(plural(1, "wave")).toBe("1 wave");
    expect(plural(3, "wave")).toBe("3 waves");
  });
});

describe("shortPath", () => {
  it("keeps short paths and trims long ones from the front", () => {
    expect(shortPath("src/a.ts")).toBe("src/a.ts");
    expect(shortPath("adapters/aws-lambda/src/conninfo.test.ts", 28)).toBe(
      "…/src/conninfo.test.ts",
    );
  });
});
