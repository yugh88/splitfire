import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/track/[id]/route";
import type { PlanReport } from "@/lib/plan/events";
import { kv } from "@/lib/store/kv";
import type { Plan, Task } from "@/lib/types";

const PLAN_ID = "fedcba9876543210";
const TOKEN = "secret-token-value";

const task: Task = {
  id: "auth-contract",
  title: "A",
  goal: "g",
  kind: "feature",
  ownedFiles: ["a.ts"],
  readFiles: [],
  dependsOn: [],
  difficulty: 1,
  model: "m",
  estTokens: 1,
  estCostUsd: 0,
  estMinutes: 5,
  acceptance: [],
};

const plan: Plan = {
  id: PLAN_ID,
  repo: "acme/app",
  sha: "base",
  request: "build it",
  tasks: [task],
  collisionScore: 0,
  serialMinutes: 5,
  parallelMinutes: 5,
  speedup: 1,
  agents: 2,
  tokensFullRepo: 0,
  tokensWithPacks: 0,
  totalCostUsd: 0,
};

const report: PlanReport = {
  plan,
  planner: "deterministic",
  notice: null,
  draft: [],
  collisions: [],
  collisionScoreBefore: 0,
  repairs: [],
  criticalPath: [],
};

const call = (id: string) =>
  GET(new Request("http://localhost/api/track/" + id), {
    params: Promise.resolve({ id }),
  });

beforeAll(async () => {
  process.env.GITHUB_TOKEN = TOKEN;
  await kv().set(`plan:${PLAN_ID}`, report);
});

afterAll(() => {
  delete process.env.GITHUB_TOKEN;
  vi.unstubAllGlobals();
});

describe("GET /api/track/[id]", () => {
  it("returns 404 for an unknown plan", async () => {
    const res = await call("ffffffffffffffff");
    expect(res.status).toBe(404);
  });

  it("returns 404 for an id that cannot be a plan", async () => {
    const res = await call("not-a-plan");
    expect(res.status).toBe(404);
  });

  it("returns tracks for a stored plan without exposing the token", async () => {
    const seen: RequestInit[] = [];
    const impl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push(init ?? {});
      const url = String(input);
      const body = url.endsWith("/git/matching-refs/heads/splitfire/")
        ? "[]"
        : JSON.stringify({ default_branch: "main" });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    vi.stubGlobal("fetch", impl);

    const res = await call(PLAN_ID);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text)).toEqual([
      {
        taskId: "auth-contract",
        status: "waiting",
        branch: "splitfire/auth-contract",
        updatedAt: expect.any(String),
      },
    ]);

    const headers = new Headers(seen[0]?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(seen.some((init) => String(init.body ?? "").includes(TOKEN))).toBe(false);
  });
});
