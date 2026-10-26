import { describe, expect, it } from "vitest";
import { isAcyclic, repairDependencies, topoOrder } from "@/lib/partition/dag";

const t = (id: string, dependsOn: string[] = []) => ({ id, dependsOn });

describe("repairDependencies", () => {
  it("drops unknown and self dependencies", () => {
    const { tasks, repairs } = repairDependencies([t("a", ["a", "ghost"]), t("b", ["a"])]);
    expect(tasks).toEqual([t("a"), t("b", ["a"])]);
    expect(repairs).toHaveLength(2);
  });

  it("breaks a two-task cycle deterministically", () => {
    const { tasks, repairs } = repairDependencies([t("a", ["b"]), t("b", ["a"])]);
    expect(isAcyclic(tasks)).toBe(true);
    expect(tasks).toEqual([t("a", ["b"]), t("b")]);
    expect(repairs).toEqual(["b: removed dependency on a to break a cycle"]);
  });

  it("breaks longer cycles and keeps acyclic edges", () => {
    const input = [t("a", ["c"]), t("b", ["a"]), t("c", ["b"]), t("d", ["a", "c"])];
    expect(isAcyclic(input)).toBe(false);
    const { tasks } = repairDependencies(input);
    expect(isAcyclic(tasks)).toBe(true);
    expect(tasks.find((x) => x.id === "d")!.dependsOn).toEqual(["a", "c"]);
    expect(tasks.flatMap((x) => x.dependsOn)).toHaveLength(4);
  });

  it("leaves an acyclic plan untouched", () => {
    const input = [t("a"), t("b", ["a"]), t("c", ["a", "b"])];
    expect(repairDependencies(input)).toEqual({ tasks: input, repairs: [] });
  });
});

describe("topoOrder", () => {
  it("puts dependencies first", () => {
    const order = topoOrder([t("c", ["b"]), t("b", ["a"]), t("a")]);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });
});
