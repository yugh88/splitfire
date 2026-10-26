import { describe, expect, it } from "vitest";
import type { RepoAnalysis } from "@/lib/analyze/load";
import { partition } from "@/lib/partition";
import { assemblePlan } from "@/lib/plan/assemble";
import { proposal, testConfig } from "../helpers/plan";

const file = (path: string, bytes = 2_000) => ({ path, lang: "ts" as const, bytes });

const analysis: RepoAnalysis = {
  repo: "acme/app",
  sha: "abc",
  files: ["src/types.ts", "src/store.ts", "src/form.tsx", "src/page.tsx", "src/nav.tsx"].map((p) =>
    file(p),
  ),
  edges: [
    { from: "src/store.ts", to: "src/types.ts" },
    { from: "src/form.tsx", to: "src/types.ts" },
    { from: "src/page.tsx", to: "src/types.ts" },
    { from: "src/nav.tsx", to: "src/types.ts" },
  ],
  symbols: {},
  parser: "tree-sitter",
  tooling: { packageManager: "npm", scripts: ["typecheck"], testRunner: null, typescript: true },
  skipped: 0,
  truncated: false,
};

describe("assemblePlan", () => {
  it("applies contracts-first when it shortens the parallel time (chain → fan-out)", () => {
    const parts = partition(
      [
        proposal("store", ["src/store.ts", "src/types.ts"], [], { difficulty: 3 }),
        proposal("form", ["src/form.tsx"], ["store"]),
        proposal("page", ["src/page.tsx"], ["store"]),
        proposal("nav", ["src/nav.tsx"], ["store"]),
      ],
      analysis.edges,
    );
    const { plan, repairs } = assemblePlan({
      id: "p",
      analysis,
      request: "r",
      partition: parts,
      agents: 4,
      cfg: testConfig(),
    });
    const contract = plan.tasks.find((t) => t.kind === "contract");
    expect(contract?.ownedFiles).toEqual(["src/types.ts"]);
    expect(
      plan.tasks.filter((t) => t.dependsOn.length === 1 && t.dependsOn[0] === contract?.id),
    ).toHaveLength(4);
    expect(repairs.some((r) => r.kind === "contract")).toBe(true);
    expect(plan.collisionScore).toBe(0);
    expect(plan.speedup).toBeGreaterThan(1.5);
  });

  it("fills context packs, model routing, estimates and acceptance checks", () => {
    const parts = partition(
      [proposal("form", ["src/form.tsx"], [], { difficulty: 3 })],
      analysis.edges,
    );
    const { plan } = assemblePlan({
      id: "p",
      analysis,
      request: "r",
      partition: parts,
      agents: 4,
      cfg: testConfig(),
    });
    const [task] = plan.tasks;
    expect(task).toMatchObject({ readFiles: ["src/types.ts"], model: "big" });
    expect(task!.acceptance).toEqual([
      "npm run typecheck",
      "git diff --name-only touches only owned files",
    ]);
    expect(task!.estCostUsd).toBeGreaterThan(0);
    expect(plan.tokensWithPacks).toBeLessThan(plan.tokensFullRepo);
  });
});
