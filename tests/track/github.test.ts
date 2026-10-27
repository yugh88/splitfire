import { describe, expect, it } from "vitest";
import { memory } from "@/lib/store/kv";
import { getTracks, TRACK_CACHE_SECONDS, TrackError, type TrackPlan } from "@/lib/track/github";
import { fakeFetch } from "../helpers/fetch";

const API = "https://api.github.com/repos/acme/app";
const REFS = `${API}/git/matching-refs/heads/splitfire/`;

const plan: TrackPlan = {
  id: "0123456789abcdef",
  repo: "acme/app",
  sha: "base",
  tasks: [
    { id: "auth-contract", dependsOn: [] },
    { id: "oauth-integration-test", dependsOn: ["auth-contract"] },
  ],
};

const checks = (sha: string, name: string) =>
  `${API}/commits/${sha}/check-runs?check_name=${encodeURIComponent(name)}&per_page=1`;

const checkBody = (sha: string, name: string, status: string, conclusion: string | null) => ({
  check_runs: [
    {
      name,
      head_sha: sha,
      status,
      conclusion,
      html_url: `https://github.com/acme/app/runs/${name.replace("/", "-")}`,
    },
  ],
});

describe("getTracks", () => {
  it("marks every task waiting on its task-id branch when there are no splitfire branches", async () => {
    const { impl, calls } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: { body: [] },
    });
    const tracks = await getTracks(plan, { fetchImpl: impl, store: memory(), now: () => 0 });

    expect(tracks).toEqual([
      {
        taskId: "auth-contract",
        status: "waiting",
        branch: "splitfire/auth-contract",
        updatedAt: new Date(0).toISOString(),
      },
      {
        taskId: "oauth-integration-test",
        status: "waiting",
        branch: "splitfire/oauth-integration-test",
        updatedAt: new Date(0).toISOString(),
      },
    ]);
    expect(calls.some((url) => url.includes("/compare/"))).toBe(false);
  });

  it("derives passed from a successful check run and merged from the default branch", async () => {
    const { impl, calls } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: {
        body: [
          { ref: "refs/heads/splitfire/auth-contract", object: { sha: "head0" } },
          { ref: "refs/heads/splitfire/oauth-integration-test", object: { sha: "head1" } },
        ],
      },
      [`${API}/compare/base...head0`]: { body: { status: "ahead", ahead_by: 2 } },
      [`${API}/compare/main...head0`]: { body: { status: "ahead" } },
      [checks("head0", "splitfire/auth-contract")]: {
        body: checkBody("head0", "splitfire/auth-contract", "completed", "success"),
      },
      [`${API}/compare/base...head1`]: { body: { status: "ahead", ahead_by: 1 } },
      [`${API}/compare/main...head1`]: { body: { status: "behind" } },
    });

    const tracks = await getTracks(plan, { fetchImpl: impl, store: memory(), now: () => 1000 });

    expect(tracks.find((t) => t.taskId === "auth-contract")).toMatchObject({
      status: "passed",
      branch: "splitfire/auth-contract",
      headSha: "head0",
      checkUrl: "https://github.com/acme/app/runs/splitfire-auth-contract",
    });
    expect(tracks.find((t) => t.taskId === "oauth-integration-test")).toMatchObject({
      status: "merged",
      headSha: "head1",
    });
    expect(tracks.find((t) => t.taskId === "oauth-integration-test")?.checkUrl).toBeUndefined();
    // Merged tasks skip check-run traffic to protect the rate limit.
    expect(calls.some((url) => url.includes("head1/check-runs"))).toBe(false);
  });

  it("reports checking while the check run is in progress", async () => {
    const { impl } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: { body: [{ ref: "refs/heads/splitfire/auth-contract", object: { sha: "head0" } }] },
      [`${API}/compare/base...head0`]: { body: { status: "ahead" } },
      [`${API}/compare/main...head0`]: { body: { status: "ahead" } },
      [checks("head0", "splitfire/auth-contract")]: {
        body: checkBody("head0", "splitfire/auth-contract", "in_progress", null),
      },
    });

    const tracks = await getTracks(plan, { fetchImpl: impl, store: memory() });
    expect(tracks.find((t) => t.taskId === "auth-contract")?.status).toBe("checking");
    expect(tracks.find((t) => t.taskId === "oauth-integration-test")?.status).toBe("waiting");
  });

  it("tracks the legacy splitfire/Tn label branch when that is what exists", async () => {
    const { impl } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: { body: [{ ref: "refs/heads/splitfire/T0", object: { sha: "head0" } }] },
      [`${API}/compare/base...head0`]: { body: { status: "ahead" } },
      [`${API}/compare/main...head0`]: { body: { status: "ahead" } },
      [checks("head0", "splitfire/T0")]: {
        body: checkBody("head0", "splitfire/T0", "completed", "success"),
      },
    });

    const tracks = await getTracks(plan, { fetchImpl: impl, store: memory() });
    expect(tracks.find((t) => t.taskId === "auth-contract")).toMatchObject({
      status: "passed",
      branch: "splitfire/T0",
    });
  });

  it("prefers the task-id branch when both the id and legacy label branches exist", async () => {
    const { impl } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: {
        body: [
          { ref: "refs/heads/splitfire/T0", object: { sha: "legacy" } },
          { ref: "refs/heads/splitfire/auth-contract", object: { sha: "head0" } },
        ],
      },
      [`${API}/compare/base...head0`]: { body: { status: "ahead" } },
      [`${API}/compare/main...head0`]: { body: { status: "ahead" } },
      [checks("head0", "splitfire/auth-contract")]: {
        body: checkBody("head0", "splitfire/auth-contract", "completed", "success"),
      },
    });

    const tracks = await getTracks(plan, { fetchImpl: impl, store: memory() });
    expect(tracks.find((t) => t.taskId === "auth-contract")).toMatchObject({
      status: "passed",
      branch: "splitfire/auth-contract",
      headSha: "head0",
    });
  });

  it("never requests a branch built from an unsafe task id", async () => {
    const unsafe: TrackPlan = {
      ...plan,
      tasks: [{ id: "../x", dependsOn: [] }],
    };
    const { impl, calls } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: { body: [] },
    });

    const tracks = await getTracks(unsafe, { fetchImpl: impl, store: memory(), now: () => 0 });
    expect(tracks).toEqual([
      {
        taskId: "../x",
        status: "waiting",
        branch: "splitfire/T0",
        updatedAt: new Date(0).toISOString(),
      },
    ]);
    for (const url of calls) expect(url).not.toContain("..");
  });

  it("treats a branch that is not ahead of the base sha as waiting", async () => {
    const { impl, calls } = fakeFetch({
      [API]: { body: { default_branch: "main" } },
      [REFS]: { body: [{ ref: "refs/heads/splitfire/auth-contract", object: { sha: "head0" } }] },
      [`${API}/compare/base...head0`]: { body: { status: "identical" } },
    });

    const tracks = await getTracks(plan, { fetchImpl: impl, store: memory() });
    expect(tracks.find((t) => t.taskId === "auth-contract")?.status).toBe("waiting");
    expect(calls.some((url) => url.includes("/check-runs"))).toBe(false);
  });

  it(`caches snapshots per plan for ${TRACK_CACHE_SECONDS}s`, async () => {
    const store = memory();
    const routes = {
      [API]: { body: { default_branch: "main" } },
      [REFS]: { body: [] },
    };
    const first = fakeFetch(routes);
    await getTracks(plan, { fetchImpl: first.impl, store });
    const second = fakeFetch(routes);
    await getTracks(plan, { fetchImpl: second.impl, store });
    expect(first.calls.length).toBeGreaterThan(0);
    expect(second.calls).toEqual([]);
  });

  it("maps rate limiting to a typed error", async () => {
    const { impl } = fakeFetch({
      [API]: { status: 403, body: {} },
      [REFS]: { body: [] },
    });
    await expect(getTracks(plan, { fetchImpl: impl, store: memory() })).rejects.toMatchObject({
      code: "rate_limited",
    });
  });

  it("rejects a repo that is not owner/name", async () => {
    const { impl } = fakeFetch({});
    const error = await getTracks(
      { ...plan, repo: "not-a-repo" },
      { fetchImpl: impl, store: memory() },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TrackError);
    expect(error).toMatchObject({ code: "bad_repo" });
  });
});
