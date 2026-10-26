import { describe, expect, it } from "vitest";
import { isAcyclic } from "@/lib/partition/dag";
import { CONTRACT_ID, insertContracts, isTypeLike } from "@/lib/partition/contracts";
import { collisionScore, type DraftTask } from "@/lib/partition/ownership";

const t = (
  id: string,
  ownedFiles: string[],
  dependsOn: string[] = [],
  kind: DraftTask["kind"] = "feature",
): DraftTask => ({
  id,
  title: id,
  goal: id,
  kind,
  ownedFiles,
  readFiles: [],
  dependsOn,
  difficulty: 2,
});

const bytes = new Map<string, number>();

describe("isTypeLike", () => {
  it("matches declaration-shaped files", () => {
    expect(isTypeLike("src/types.ts")).toBe(true);
    expect(isTypeLike("lib/schemas/user.ts")).toBe(true);
    expect(isTypeLike("global.d.ts")).toBe(true);
    expect(isTypeLike("src/settings-types.ts")).toBe(true);
    expect(isTypeLike("app/models.py")).toBe(true);
    expect(isTypeLike("src/prototype.ts")).toBe(false);
    expect(isTypeLike("api/route.ts")).toBe(false);
  });
});

describe("insertContracts", () => {
  it("turns a chain into a fan-out through a contract task", () => {
    const tasks = [
      t("store", ["src/store.ts", "src/settings-types.ts"]),
      t("form", ["src/form.tsx"], ["store"]),
      t("page", ["src/page.tsx"], ["store"]),
    ];
    const edges = [
      { from: "src/form.tsx", to: "src/settings-types.ts" },
      { from: "src/page.tsx", to: "src/settings-types.ts" },
      { from: "src/store.ts", to: "src/settings-types.ts" },
    ];
    const result = insertContracts(tasks, edges, bytes);
    expect(result.inserted).toBe(true);
    const contract = result.tasks[0]!;
    expect(contract).toMatchObject({
      id: CONTRACT_ID,
      kind: "contract",
      ownedFiles: ["src/settings-types.ts"],
      dependsOn: [],
    });
    const deps = Object.fromEntries(result.tasks.map((x) => [x.id, x.dependsOn]));
    expect(deps).toMatchObject({ store: [CONTRACT_ID], form: [CONTRACT_ID], page: [CONTRACT_ID] });
    expect(result.tasks.find((x) => x.id === "form")!.readFiles).toContain("src/settings-types.ts");
    expect(collisionScore(result.tasks)).toBe(0);
    expect(isAcyclic(result.tasks)).toBe(true);
    expect(result.repairs[0]).toEqual({
      kind: "contract",
      task: CONTRACT_ID,
      files: ["src/settings-types.ts"],
      from: ["store"],
    });
  });

  it("falls back to type-like files when imports say nothing (new files)", () => {
    const result = insertContracts(
      [t("api", ["api/route.ts", "api/types.ts"]), t("ui", ["ui/view.tsx"], ["api"])],
      [],
      bytes,
    );
    expect(result.tasks[0]!.ownedFiles).toEqual(["api/types.ts"]);
  });

  it("leaves edges alone when there is no interface, it is too big, or it is the whole task", () => {
    expect(insertContracts([t("a", ["a.ts"]), t("b", ["b.ts"], ["a"])], [], bytes).inserted).toBe(
      false,
    );
    const big = new Map([["a/types.ts", 50_000]]);
    expect(
      insertContracts([t("a", ["a/types.ts", "a/impl.ts"]), t("b", ["b.ts"], ["a"])], [], big)
        .inserted,
    ).toBe(false);
    expect(
      insertContracts([t("a", ["a/types.ts"]), t("b", ["b.ts"], ["a"])], [], bytes).inserted,
    ).toBe(false);
  });

  it("does not split tasks that are already contracts", () => {
    const tasks = [t("c", ["types.ts", "more-types.ts"], [], "contract"), t("b", ["b.ts"], ["c"])];
    expect(insertContracts(tasks, [{ from: "b.ts", to: "types.ts" }], bytes).inserted).toBe(false);
  });
});

describe("insertContracts interface rules", () => {
  it("does not pull large implementation files into a contract", () => {
    const sizes = new Map([["src/vanilla.ts", 9_000]]);
    const tasks = [t("core", ["src/vanilla.ts", "src/react.ts"]), t("mw", ["src/mw.ts"], ["core"])];
    const result = insertContracts(tasks, [{ from: "src/mw.ts", to: "src/vanilla.ts" }], sizes);
    expect(result.inserted).toBe(false);
  });

  it("prefers type-like files among the imported ones", () => {
    const tasks = [
      t("core", ["src/types.ts", "src/impl.ts", "src/x.ts"]),
      t("mw", ["src/mw.ts"], ["core"]),
    ];
    const edges = [
      { from: "src/mw.ts", to: "src/types.ts" },
      { from: "src/mw.ts", to: "src/impl.ts" },
    ];
    expect(insertContracts(tasks, edges, bytes).tasks[0]!.ownedFiles).toEqual(["src/types.ts"]);
  });
});
