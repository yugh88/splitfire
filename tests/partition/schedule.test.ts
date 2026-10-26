import { describe, expect, it } from "vitest";
import { criticalPath, schedule, simulate } from "@/lib/partition/schedule";

const j = (id: string, estMinutes: number, dependsOn: string[] = []) => ({
  id,
  estMinutes,
  dependsOn,
});

describe("criticalPath", () => {
  it("follows the longest chain", () => {
    const jobs = [j("a", 10), j("b", 30, ["a"]), j("c", 5, ["a"]), j("d", 10, ["b", "c"])];
    expect(criticalPath(jobs)).toEqual({ minutes: 50, path: ["a", "b", "d"] });
  });

  it("handles an empty plan", () => {
    expect(criticalPath([])).toEqual({ minutes: 0, path: [] });
  });
});

describe("simulate", () => {
  it("is limited by agents when work is independent", () => {
    const jobs = [j("a", 10), j("b", 10), j("c", 10), j("d", 10)];
    expect(simulate(jobs, 4)).toEqual({ makespan: 10, peak: 4 });
    expect(simulate(jobs, 2)).toEqual({ makespan: 20, peak: 2 });
  });

  it("is limited by the chain when work is serial", () => {
    expect(simulate([j("a", 10), j("b", 10, ["a"]), j("c", 10, ["b"])], 4)).toEqual({
      makespan: 30,
      peak: 1,
    });
  });
});

describe("schedule", () => {
  it("turns a contract + fan-out into a speedup", () => {
    const jobs = [j("contract", 10), ...["w", "x", "y", "z"].map((id) => j(id, 30, ["contract"]))];
    const s = schedule(jobs);
    expect(s.serialMinutes).toBe(130);
    expect(s.parallelMinutes).toBe(40);
    expect(s.agents).toBe(4);
    expect(s.speedup).toBe(3.3);
  });

  it("caps agents at four", () => {
    const s = schedule(Array.from({ length: 8 }, (_, i) => j(`t${i}`, 10)));
    expect(s.agents).toBe(4);
    expect(s.parallelMinutes).toBe(20);
    expect(s.speedup).toBe(4);
  });
});
