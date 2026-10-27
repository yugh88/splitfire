import { createHash } from "node:crypto";
import { z } from "zod";
import { kv } from "@/lib/store/kv";
import type { PlanReport } from "@/lib/plan/events";

export const runtime = "nodejs";

const SHARE_TTL_SECONDS = 30 * 24 * 3600;
const MAX_BODY_BYTES = 1_000_000;

const TaskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().max(300),
  goal: z.string().max(2_000),
  kind: z.enum(["contract", "feature", "test", "docs"]),
  ownedFiles: z.array(z.string().max(500)).max(500),
  readFiles: z.array(z.string().max(500)).max(2_000),
  dependsOn: z.array(z.string().max(80)).max(100),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  model: z.string().max(200),
  estTokens: z.number(),
  estCostUsd: z.number(),
  estMinutes: z.number(),
  acceptance: z.array(z.string().max(2_000)).max(100),
});

const RepairSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("owner"), file: z.string(), winner: z.string(), loser: z.string() }),
  z.object({ kind: z.literal("dropped"), task: z.string() }),
  z.object({ kind: z.literal("unknown-dep"), task: z.string(), dep: z.string() }),
  z.object({ kind: z.literal("self-dep"), task: z.string() }),
  z.object({ kind: z.literal("cycle"), task: z.string(), dep: z.string() }),
  z.object({
    kind: z.literal("contract"),
    task: z.string(),
    files: z.array(z.string()),
    from: z.array(z.string()),
  }),
  z.object({ kind: z.literal("fan-out"), task: z.string(), dep: z.string(), via: z.string() }),
]);

const ReportSchema = z.object({
  plan: z.object({
    id: z.string(),
    repo: z.string().max(200),
    sha: z.string().max(100),
    request: z.string().max(500),
    tasks: z.array(TaskSchema).min(1).max(100),
    collisionScore: z.number(),
    serialMinutes: z.number(),
    parallelMinutes: z.number(),
    speedup: z.number(),
    agents: z.number(),
    tokensFullRepo: z.number(),
    tokensWithPacks: z.number(),
    totalCostUsd: z.number(),
  }),
  planner: z.enum(["llm", "fallback", "deterministic", "mock"]),
  notice: z.string().nullable(),
  draft: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        ownedFiles: z.array(z.string()),
      }),
    )
    .max(100),
  collisions: z.array(z.object({ file: z.string(), tasks: z.array(z.string()) })).max(500),
  collisionScoreBefore: z.number(),
  repairs: z.array(RepairSchema).max(2_000),
  criticalPath: z.array(z.string()).max(100),
});

const BodySchema = z.object({ report: ReportSchema });

/** Content-addressed id for an edited plan: saving the same plan twice reuses its link. */
function shareId(report: PlanReport): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        report.plan.repo,
        report.plan.sha,
        report.plan.request,
        report.plan.agents,
        report.plan.tasks,
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

/**
 * Stores an edited plan and returns its share id for the existing `/p/[id]` page. The planner
 * writes plans through the same store; this route only adds the "save my re-split" write.
 */
export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "Plan is too large to share." }, { status: 413 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Plan is too large to share." }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "Send a JSON plan report." }, { status: 400 });
  }
  const body = BodySchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: "Send a valid plan report." }, { status: 400 });
  }

  const report = body.data.report as PlanReport;
  const id = shareId(report);
  const stored: PlanReport = { ...report, plan: { ...report.plan, id } };
  await kv().set(`plan:${id}`, stored, SHARE_TTL_SECONDS);
  return Response.json({ id }, { headers: { "cache-control": "no-store" } });
}
