import { describe, expect, it } from "vitest";
import { fetchSnapshot, IngestError, resolveCommit } from "@/lib/ingest/github";
import { fakeFetch } from "./helpers/fetch";

const API = "https://api.github.com/repos/acme/app";
const RAW = "https://raw.githubusercontent.com/acme/app/abc123";

describe("resolveCommit", () => {
  it("uses the default branch when no ref is given", async () => {
    const { impl } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [`${API}/commits/main`]: { body: { sha: "abc123" } },
    });
    await expect(resolveCommit({ owner: "acme", repo: "app" }, { fetchImpl: impl })).resolves.toBe(
      "abc123",
    );
  });

  it("maps 404 and 403 to typed errors", async () => {
    const notFound = fakeFetch({});
    await expect(
      resolveCommit({ owner: "acme", repo: "app" }, { fetchImpl: notFound.impl }),
    ).rejects.toMatchObject({ code: "not_found" });

    const limited = fakeFetch({ [API]: { status: 403, body: {} } });
    const err = await resolveCommit(
      { owner: "acme", repo: "app" },
      { fetchImpl: limited.impl },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IngestError);
    expect(err).toMatchObject({ code: "rate_limited" });
  });
});

describe("fetchSnapshot", () => {
  it("fetches only selected files from raw, at the pinned sha", async () => {
    const { impl, calls } = fakeFetch({
      [`${API}/git/trees/abc123?recursive=1`]: {
        body: {
          tree: [
            { path: "src", type: "tree" },
            { path: "src/index.ts", type: "blob", size: 20 },
            { path: "src/my file.ts", type: "blob", size: 5 },
            { path: "node_modules/x/index.js", type: "blob", size: 5 },
            { path: "package-lock.json", type: "blob", size: 5 },
          ],
        },
      },
      [`${RAW}/src/index.ts`]: { body: 'import "./my file";' },
      [`${RAW}/src/my%20file.ts`]: { body: "export {};" },
    });
    const snap = await fetchSnapshot({ owner: "acme", repo: "app" }, "abc123", { fetchImpl: impl });
    expect(snap.files.map((f) => f.path)).toEqual(["src/index.ts", "src/my file.ts"]);
    expect(snap.contents["src/my file.ts"]).toBe("export {};");
    expect(snap.skipped).toBe(2);
    expect(calls.some((c) => c.includes("node_modules"))).toBe(false);
  });
});
