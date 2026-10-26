import { describe, expect, it } from "vitest";
import { parseRepoUrl } from "@/lib/ingest/repo-url";

describe("parseRepoUrl", () => {
  it.each([
    ["vercel/next.js", { owner: "vercel", repo: "next.js" }],
    ["https://github.com/vercel/next.js", { owner: "vercel", repo: "next.js" }],
    ["github.com/a/b.git/", { owner: "a", repo: "b" }],
    ["https://github.com/a/b?tab=readme", { owner: "a", repo: "b" }],
    ["https://github.com/a/b/tree/feat/x", { owner: "a", repo: "b", ref: "feat/x" }],
  ])("parses %s", (input, expected) => {
    expect(parseRepoUrl(input)).toEqual(expected);
  });

  it.each(["", "nope", "https://github.com/a", "a/b/blob/main/x.ts", "a b/c"])(
    "rejects %s",
    (input) => {
      expect(parseRepoUrl(input)).toBeNull();
    },
  );
});
