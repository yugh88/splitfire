import { describe, expect, it } from "vitest";
import {
  allPrompts,
  planWaves,
  splitfirePack,
  taskBranch,
  taskPrompt,
  taskWorktree,
  wavePrompts,
} from "@/lib/context/export";
import { generateGatesWorkflow } from "@/lib/gates/workflow";
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

  it("gives the exact worktree command, branch and push-only rule", () => {
    const prompt = taskPrompt(plan.tasks[0]!, plan);
    expect(taskBranch(plan.tasks[0]!)).toBe("splitfire/ui");
    expect(taskWorktree(plan, plan.tasks[0]!)).toBe("../app-ui");
    expect(prompt).toContain(
      "## Start (run from the repo root)\n```sh\ngit worktree add ../app-ui -b splitfire/ui\ncd ../app-ui\n```",
    );
    expect(prompt).toContain("no `Co-Authored-By`");
    expect(prompt).toContain(
      "Push the branch: `git push -u origin splitfire/ui`. Push `splitfire/ui`, do not merge.",
    );
  });

  it("omits empty sections", () => {
    const prompt = taskPrompt(plan.tasks[1]!, plan);
    expect(prompt).not.toContain("Context pack");
    expect(prompt).not.toContain("Before you start");
  });
});

describe("planWaves / wavePrompts", () => {
  it("groups tasks by dependency depth", () => {
    expect(planWaves(plan).map((w) => w.tasks.map((t) => t.id))).toEqual([["contracts"], ["ui"]]);
  });

  it("builds one paste-ready block with a session separator per task", () => {
    const block = wavePrompts(plan, 0);
    expect(block).toContain("# Wave 1 · 1 task in parallel");
    expect(block).toContain("=== SESSION 1 of 1 · T0 · paste into its own Alan session ===");
    expect(block).toContain("git worktree add ../app-contracts -b splitfire/contracts");

    const second = wavePrompts(plan, 1);
    expect(second).toContain("# Wave 2 · 1 task in parallel");
    expect(second).toContain("git worktree add ../app-ui -b splitfire/ui");
    expect(second).not.toContain("splitfire/contracts`.");
  });

  it("returns an empty block for an unknown wave", () => {
    expect(wavePrompts(plan, 9)).toBe("");
  });
});

describe("allPrompts / splitfirePack", () => {
  it("orders prompts by wave", () => {
    const text = allPrompts(plan);
    expect(text.indexOf("# T0")).toBeLessThan(text.indexOf("# T1"));
    expect(text.split("\n---\n")).toHaveLength(2);
  });

  it("writes README, plan.json, the gate workflow and one file per task", () => {
    const pack = splitfirePack(plan);
    expect(Object.keys(pack).sort()).toEqual([
      ".github/workflows/splitfire-gates.yml",
      ".splitfire/README.md",
      ".splitfire/plan.json",
      ".splitfire/tasks/T0-contracts.md",
      ".splitfire/tasks/T1-ui.md",
    ]);
    expect(JSON.parse(pack[".splitfire/plan.json"]!)).toEqual(plan);
    expect(pack[".github/workflows/splitfire-gates.yml"]).toEqual(generateGatesWorkflow(plan));
    expect(pack[".splitfire/README.md"]).toContain(
      "| T1 | 2 | feature | Title ui | 1 | T0 | fast | 20 min |",
    );
    expect(pack[".splitfire/README.md"]).toContain("Serial 40m → 40m with 1 agent (1×)");
    expect(pack[".splitfire/README.md"]).toContain("## How done-checks work");
    expect(pack[".splitfire/README.md"]).toContain("check run named after the branch");
  });
});
