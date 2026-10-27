import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/share/route";
import type { PlanReport } from "@/lib/plan/events";
import { kv } from "@/lib/store/kv";
import type { Plan, Task } from "@/lib/types";

const task: Task = {
  id: "t0",
  title: "Shared contracts",
  goal: "define types",
  kind: "contract",
  ownedFiles: ["src/types.ts"],
  readFiles: [],
  dependsOn: [],
  difficulty: 1,
  model: "fast",
  estTokens: 100,
  estCostUsd: 0,
  estMinutes: 10,
  acceptance: ["npx tsc --noEmit"],
};

const plan: Plan = {
  id: "fedcba9876543210",
  repo: "acme/app",
  sha: "abc1234",
  request: "build it",
  tasks: [task],
  collisionScore: 0,
  serialMinutes: 10,
  parallelMinutes: 10,
  speedup: 1,
  agents: 2,
  tokensFullRepo: 1_000,
  tokensWithPacks: 500,
  totalCostUsd: 0,
};

const report: PlanReport = {
  plan,
  planner: "mock",
  notice: null,
  draft: [{ id: "t0", title: task.title, ownedFiles: task.ownedFiles }],
  collisions: [],
  collisionScoreBefore: 0,
  repairs: [],
  criticalPath: ["t0"],
};

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/share", () => {
  it("stores an edited plan under a content-addressed share id", async () => {
    const res = await post({ report });
    expect(res.status).toBe(200);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[a-f0-9]{16}$/);

    const stored = await kv().get<PlanReport>(`plan:${id}`);
    expect(stored?.plan.id).toBe(id);
    expect(stored?.plan.tasks[0]?.ownedFiles).toEqual(["src/types.ts"]);
    expect(stored?.criticalPath).toEqual(["t0"]);
  });

  it("reuses the same link when the same plan is saved twice", async () => {
    const first = (await (await post({ report })).json()) as { id: string };
    const second = (await (await post({ report })).json()) as { id: string };
    expect(second.id).toBe(first.id);
  });

  it("rejects an invalid report and malformed JSON", async () => {
    expect((await post({ report: { plan: {} } })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
  });
});
