import { describe, expect, it } from "vitest";
import { loadRepoAnalysis } from "@/lib/analyze/load";
import { memory } from "@/lib/store/kv";
import { fakeFetch } from "./helpers/fetch";

describe("loadRepoAnalysis", () => {
  it("caches by sha and skips fetch + parse on the second call", async () => {
    const api = "https://api.github.com/repos/acme/app";
    const { impl, calls } = fakeFetch({
      [api]: { body: { default_branch: "main" } },
      [`${api}/commits/main`]: { body: { sha: "s1" } },
      [`${api}/git/trees/s1?recursive=1`]: {
        body: {
          tree: [
            { path: "a.ts", type: "blob", size: 1 },
            { path: "b.ts", type: "blob", size: 1 },
          ],
        },
      },
      "https://raw.githubusercontent.com/acme/app/s1/a.ts": { body: 'import { b } from "./b";' },
      "https://raw.githubusercontent.com/acme/app/s1/b.ts": { body: "export const b = 1;" },
    });
    const store = memory();
    const ref = { owner: "acme", repo: "app" };

    const first = await loadRepoAnalysis(ref, { store, fetchImpl: impl });
    expect(first.cacheHit).toBe(false);
    expect(first.analysis.edges).toEqual([{ from: "a.ts", to: "b.ts" }]);
    expect(first.analysis).not.toHaveProperty("contents");

    const before = calls.length;
    const second = await loadRepoAnalysis(ref, { store, fetchImpl: impl });
    expect(second.cacheHit).toBe(true);
    expect(second.analysis).toEqual(first.analysis);
    expect(calls.length - before).toBe(2); // only the sha lookup
  });
});
