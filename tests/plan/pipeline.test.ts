import { describe, expect, it } from "vitest";
import type { PlanEvent } from "@/lib/plan/events";
import { planId, runPlan } from "@/lib/plan/pipeline";
import { memory } from "@/lib/store/kv";
import { fakeFetch } from "../helpers/fetch";
import { loadFixture } from "../helpers/fixture";
import type { LlmCall, LlmResult } from "@/lib/plan/llm";
import { proposal, testConfig } from "../helpers/plan";

function githubForFixture() {
  const { files, contents } = loadFixture();
  const api = "https://api.github.com/repos/acme/sample";
  const routes: Parameters<typeof fakeFetch>[0] = {
    [api]: { body: { default_branch: "main" } },
    [`${api}/commits/main`]: { body: { sha: "sha1" } },
    [`${api}/git/trees/sha1?recursive=1`]: {
      body: { tree: files.map((f) => ({ path: f.path, type: "blob", size: f.bytes })) },
    },
  };
  for (const f of files) {
    routes[`https://raw.githubusercontent.com/acme/sample/sha1/${f.path}`] = {
      body: contents[f.path],
    };
  }
  return fakeFetch(routes);
}

async function collect(run: (emit: (e: PlanEvent) => void) => Promise<void>) {
  const events: PlanEvent[] = [];
  await run((e) => events.push(e));
  return events;
}

describe("runPlan", () => {
  it("streams events in order and ends with a collision-free plan (mock mode)", async () => {
    const { impl } = githubForFixture();
    const deps = {
      cfg: testConfig({ mockLlm: true }),
      store: memory(),
      fetchImpl: impl,
      delayMs: 0,
    };
    const input = { repo: "acme/sample", request: "add user greeting", agents: 4, ip: "1.1.1.1" };
    const events = await collect((emit) => runPlan(input, emit, deps));

    const types = events.map((e) => e.type);
    expect(types.slice(0, 2)).toEqual(["ingested", "graph"]);
    expect(types.slice(-3)).toEqual(["partitioned", "metrics", "done"]);
    expect(types.filter((t) => t === "task").length).toBeGreaterThan(0);

    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("expected done");
    expect(done.data.plan.collisionScore).toBe(0);
    expect(done.data.plan.id).toBe(planId("acme/sample", "sha1", "add user greeting", 4));
    expect(done.data.plan.speedup).toBeGreaterThanOrEqual(1);

    const replay = await collect((emit) => runPlan(input, emit, deps));
    const replayDone = replay.at(-1);
    expect(replayDone?.type === "done" && replayDone.data).toEqual(done.data);
  });

  it("re-plans instead of replaying a deterministic fallback once a model is available", async () => {
    const { impl } = githubForFixture();
    const store = memory();
    const input = { repo: "acme/sample", request: "add user greeting", agents: 4, ip: "2.2.2.2" };
    const offline = { cfg: testConfig({ primary: null, fallback: null }), store, fetchImpl: impl };
    const first = await collect((emit) => runPlan(input, emit, offline));
    expect(first.at(-1)).toMatchObject({ type: "done", data: { planner: "deterministic" } });

    const again = await collect((emit) => runPlan(input, emit, offline));
    expect(again.some((e) => e.type === "task")).toBe(true); // replayed, still no model

    const tasks = [proposal("greet", ["src/index.ts"])];
    const callModel = async (call: LlmCall): Promise<LlmResult> => {
      tasks.forEach(call.onTask);
      return { ok: true, tasks, usage: { inputTokens: 10, outputTokens: 10 } };
    };
    const online = await collect((emit) =>
      runPlan(input, emit, { cfg: testConfig(), store, fetchImpl: impl, callModel }),
    );
    expect(online.at(-1)).toMatchObject({ type: "done", data: { planner: "llm" } });
    const replayed = await collect((emit) => runPlan(input, emit, offline));
    expect(replayed.at(-1)).toMatchObject({ type: "done", data: { planner: "llm" } });
  });

  it("rejects bad repo input", async () => {
    const events = await collect((emit) =>
      runPlan({ repo: "not a repo", request: "x y z", agents: 4, ip: "ip" }, emit, {
        cfg: testConfig(),
        store: memory(),
      }),
    );
    expect(events).toEqual([
      { type: "error", data: expect.objectContaining({ code: "bad_repo" }) },
    ]);
  });

  it("rate limits fresh plans per IP", async () => {
    const { impl } = githubForFixture();
    const cfg = testConfig({ primary: null, fallback: null });
    const deps = { cfg, store: memory(), fetchImpl: impl };
    const last: PlanEvent[] = [];
    for (let i = 0; i < 6; i++) {
      const events = await collect((emit) =>
        runPlan(
          { repo: "acme/sample", request: `request number ${i}`, agents: 4, ip: "9.9.9.9" },
          emit,
          deps,
        ),
      );
      last.push(events.at(-1)!);
    }
    expect(last.slice(0, 5).every((e) => e.type === "done")).toBe(true);
    expect(last[5]).toMatchObject({ type: "error", data: { code: "rate_limited" } });
  });

  it("reports GitHub failures as typed errors", async () => {
    const events = await collect((emit) =>
      runPlan({ repo: "acme/missing", request: "x y z", agents: 4, ip: "ip" }, emit, {
        cfg: testConfig(),
        store: memory(),
        fetchImpl: fakeFetch({}).impl,
      }),
    );
    expect(events).toEqual([
      { type: "error", data: expect.objectContaining({ code: "not_found" }) },
    ]);
  });
});
