import { describe, expect, it } from "vitest";
import type { RepoAnalysis } from "@/lib/analyze/load";
import { buildPrompt, MAX_PROMPT_CHARS } from "@/lib/plan/prompt";
import { fixtureAnalysis } from "../helpers/plan";

describe("buildPrompt", () => {
  it("includes the request, files with exports, and imports", async () => {
    const prompt = buildPrompt(await fixtureAnalysis(), "greet users by name");
    expect(prompt).toContain("Feature request: greet users by name");
    expect(prompt).toMatch(/src\/index\.ts · [\d.]+KB · greet/);
    expect(prompt).toContain("src/util/index.ts -> src/util/strings.ts");
  });

  it("stays under the char cap for large repos, most relevant files first", () => {
    const files = Array.from({ length: 5_000 }, (_, i) => ({
      path: `src/module${i}/very/long/path/to/file${i}.ts`,
      lang: "ts" as const,
      bytes: 2_000,
    }));
    files.push({ path: "src/billing/invoice.ts", lang: "ts", bytes: 10 });
    const analysis: RepoAnalysis = {
      repo: "a/b",
      sha: "0123456789",
      files,
      edges: files.slice(1).map((f, i) => ({ from: f.path, to: files[i]!.path })),
      symbols: {},
      parser: "tree-sitter",
      tooling: { packageManager: null, scripts: [], testRunner: null, typescript: true },
      skipped: 0,
      truncated: false,
    };
    const prompt = buildPrompt(analysis, "billing invoice export");
    expect(prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS + 500);
    expect(prompt.indexOf("src/billing/invoice.ts")).toBeLessThan(prompt.indexOf("src/module0/"));
  });
});
