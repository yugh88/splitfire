import type { RepoAnalysis } from "@/lib/analyze/load";
import { buildImportGraph } from "@/lib/analyze/graph";
import { config, type Config } from "@/lib/env";
import type { TaskProposal } from "@/lib/plan/schema";
import { loadFixture } from "./fixture";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...config({
      OPENMODEL_BASE_URL: "https://primary.test/v1",
      OPENMODEL_API_KEY: "k",
      PLANNER_MODEL: "big",
      FAST_MODEL: "small",
      FALLBACK_BASE_URL: "https://fallback.test/v1",
      FALLBACK_API_KEY: "k",
      FALLBACK_MODEL: "backup",
      MODEL_PRICES_JSON: JSON.stringify({
        big: { input: 1, output: 4 },
        small: { input: 0.1, output: 0.4 },
        backup: { input: 0.5, output: 1 },
      }),
      CREDIT_BUDGET_USD: "5",
      PLAN_MAX_COST_USD: "0.05",
    }),
    ...overrides,
  };
}

export async function fixtureAnalysis(): Promise<RepoAnalysis> {
  const { files, contents } = loadFixture();
  const graph = await buildImportGraph(files, contents);
  return {
    repo: "acme/sample",
    sha: "abc1234def",
    files,
    edges: graph.edges,
    symbols: graph.symbols,
    parser: graph.parser,
    skipped: 0,
    truncated: false,
  };
}

export function proposal(
  id: string,
  ownedFiles: string[],
  dependsOn: string[] = [],
  extra: Partial<TaskProposal> = {},
): TaskProposal {
  return {
    id,
    title: id,
    goal: `do ${id}`,
    kind: "feature",
    ownedFiles,
    dependsOn,
    difficulty: 2,
    ...extra,
  };
}
