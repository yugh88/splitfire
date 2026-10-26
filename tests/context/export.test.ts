import { describe, expect, it } from "vitest";
import { allPrompts, splitfirePack, taskPrompt } from "@/lib/context/export";
import type { Plan, Task } from "@/lib/types";

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: `Title ${id}`,
  goal: `Goal ${id}`,
  kind: "feature",
  ownedFiles: [`src/${id}.ts`],
  readFiles: [],
  dependsOn: [],
  difficulty: 2,
  model: "small",
  estTokens: 1000,
  estCostUsd: 0.001,
  estMinutes: 20,
  acceptance: ["npm run typecheck", "git diff --name-only touches only owned files"],
  ...extra,
});

const plan: Plan = {
  id: "abcdef0123456789",
  repo: "acme/app",
  sha: "1234567890abcdef",
  request: "Add settings",
  tasks: [
    task("ui", { dependsOn: ["contracts"], readFiles: ["src/types.ts"] }),
    task("contracts", { kind: "contract", ownedFiles: ["src/types.ts"], difficulty: 1 }),
  ],
  collisionScore: 0,
  serialMinutes: 40,
  parallelMinutes: 40,
  speedup: 1,
  agents: 1,
  tokensFullRepo: 10_000,
  tokensWithPacks: 2_000,
  totalCostUsd: 0.002,
};

describe("taskPrompt", () => {
  it("is a self-contained brief with ownership, context, waits and checks", () => {
    const prompt = taskPrompt(plan.tasks[0]!, plan, { shareUrl: "https://x/p/abc" });
    expect(prompt).toContain("# T1 · Title ui");
    expect(prompt).toContain("Branch: `splitfire/ui`");
    expect(prompt).toContain("## Files you own (edit only these)\n- `src/ui.ts`");
    expect(prompt).toContain("## Context pack (read-only, do not edit)\n- `src/types.ts`");
    expect(prompt).toContain(
      "Wait for T0 (Title contracts) to be merged; build against the shared contracts in `src/types.ts`.",
    );
    expect(prompt).toContain("- [ ] `npm run typecheck`");
    expect(prompt).toContain("Plan: https://x/p/abc");
  });

  it("omits empty sections", () => {
    const prompt = taskPrompt(plan.tasks[1]!, plan);
    expect(prompt).not.toContain("Context pack");
    expect(prompt).not.toContain("Before you start");
  });
});

describe("allPrompts / splitfirePack", () => {
  it("orders prompts by wave", () => {
    const text = allPrompts(plan);
    expect(text.indexOf("# T0")).toBeLessThan(text.indexOf("# T1"));
    expect(text.split("\n---\n")).toHaveLength(2);
  });

  it("writes README, plan.json and one file per task", () => {
    const pack = splitfirePack(plan);
    expect(Object.keys(pack).sort()).toEqual([
      ".splitfire/README.md",
      ".splitfire/plan.json",
      ".splitfire/tasks/T0-contracts.md",
      ".splitfire/tasks/T1-ui.md",
    ]);
    expect(JSON.parse(pack[".splitfire/plan.json"]!)).toEqual(plan);
    expect(pack[".splitfire/README.md"]).toContain(
      "| T1 | 2 | feature | Title ui | 1 | T0 | fast | 20 min |",
    );
    expect(pack[".splitfire/README.md"]).toContain("Serial 40m → 40m with 1 agent (1×)");
  });
});
