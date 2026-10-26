import { createHash } from "node:crypto";
import { loadRepoAnalysis } from "@/lib/analyze/load";
import { config, type Config } from "@/lib/env";
import { IngestError } from "@/lib/ingest/github";
import { parseRepoUrl } from "@/lib/ingest/repo-url";
import { partition } from "@/lib/partition";
import { kv, type KV } from "@/lib/store/kv";
import { allowPlan } from "@/lib/store/ratelimit";
import { assemblePlan } from "./assemble";
import type { Emit, PlanReport } from "./events";
import type { streamTaskProposals } from "./llm";
import { llmConfigured, proposeTasks } from "./planner";

/** Bump when planning logic changes so cached plans are not reused. */
export const SETTINGS_VERSION = "3";

const PLAN_TTL_SECONDS = 30 * 24 * 3600;

export type PlanInput = { repo: string; request: string; agents: number; ip: string };

type Deps = {
  cfg?: Config;
  store?: KV;
  fetchImpl?: typeof fetch;
  delayMs?: number;
  callModel?: typeof streamTaskProposals;
};

export function planId(repo: string, sha: string, request: string, agents: number): string {
  return createHash("sha256")
    .update([repo.toLowerCase(), sha, request.trim(), agents, SETTINGS_VERSION].join("\n"))
    .digest("hex")
    .slice(0, 16);
}

/** Runs ingest → analyze → plan → partition → metrics, emitting SSE events as it goes. */
export async function runPlan(input: PlanInput, emit: Emit, deps: Deps = {}): Promise<void> {
  const cfg = deps.cfg ?? config();
  const store = deps.store ?? kv();
  const started = Date.now();
  const log: Record<string, unknown> = { repo: input.repo };

  try {
    const ref = parseRepoUrl(input.repo);
    if (!ref) {
      emit({
        type: "error",
        data: { code: "bad_repo", message: "Enter a public GitHub repo URL." },
      });
      return;
    }

    const { analysis, cacheHit } = await loadRepoAnalysis(ref, {
      token: cfg.githubToken,
      store,
      fetchImpl: deps.fetchImpl,
    });
    log.cacheHit = cacheHit;
    emit({
      type: "ingested",
      data: {
        repo: analysis.repo,
        sha: analysis.sha,
        files: analysis.files.length,
        skipped: analysis.skipped,
        truncated: analysis.truncated,
        cacheHit,
      },
    });
    emit({
      type: "graph",
      data: { files: analysis.files, edges: analysis.edges, parser: analysis.parser },
    });

    const id = planId(analysis.repo, analysis.sha, input.request, input.agents);
    const stored = await store.get<PlanReport>(`plan:${id}`);
    // A deterministic fallback is replayed only while no model is available to do better.
    const upgradable = stored?.planner === "deterministic" && !cfg.mockLlm && llmConfigured(cfg);
    if (stored && !upgradable) {
      log.replay = true;
      replay(stored, emit);
      return;
    }

    if (!cfg.mockLlm && !(await allowPlan(store, input.ip))) {
      emit({
        type: "error",
        data: {
          code: "rate_limited",
          message: "Plan limit reached (5 per hour). Try again later.",
        },
      });
      return;
    }

    const proposed = await proposeTasks(analysis, input.request, {
      cfg,
      store,
      delayMs: deps.delayMs,
      callModel: deps.callModel,
      onTask: (task, attempt) => emit({ type: "task", data: { attempt, task } }),
    });
    Object.assign(log, {
      planner: proposed.planner,
      calls: proposed.calls,
      retries: Math.max(0, proposed.calls.length - 1),
    });

    const parts = partition(proposed.proposals, analysis.edges);
    const { plan, metrics, repairs } = assemblePlan({
      id,
      analysis,
      request: input.request,
      partition: parts,
      agents: input.agents,
      cfg,
    });
    emit({
      type: "partitioned",
      data: {
        tasks: plan.tasks,
        draft: parts.draft,
        collisions: parts.collisions,
        collisionScoreBefore: parts.collisionScoreBefore,
        collisionScore: parts.collisionScore,
        repairs,
      },
    });
    emit({ type: "metrics", data: metrics });

    const report: PlanReport = {
      plan,
      planner: proposed.planner,
      notice: proposed.notice,
      draft: parts.draft,
      collisions: parts.collisions,
      collisionScoreBefore: parts.collisionScoreBefore,
      repairs,
      criticalPath: metrics.criticalPath,
    };
    await store.set(`plan:${id}`, report, PLAN_TTL_SECONDS);
    emit({ type: "done", data: report });
  } catch (error) {
    const known = error instanceof IngestError;
    log.error = error instanceof Error ? error.message : String(error);
    emit({
      type: "error",
      data: {
        code: known ? error.code : "internal",
        message: known ? error.message : "Something went wrong while planning. Please retry.",
      },
    });
  } finally {
    console.info(JSON.stringify({ event: "plan", durationMs: Date.now() - started, ...log }));
  }
}

/** Re-emits a stored plan so idempotent requests cost nothing. */
function replay(report: PlanReport, emit: Emit) {
  report.plan.tasks.forEach((task) => emit({ type: "task", data: { attempt: 0, task } }));
  emit({
    type: "partitioned",
    data: {
      tasks: report.plan.tasks,
      draft: report.draft,
      collisions: report.collisions,
      collisionScoreBefore: report.collisionScoreBefore,
      collisionScore: report.plan.collisionScore,
      repairs: report.repairs,
    },
  });
  const { plan } = report;
  emit({
    type: "metrics",
    data: {
      collisionScore: plan.collisionScore,
      serialMinutes: plan.serialMinutes,
      parallelMinutes: plan.parallelMinutes,
      speedup: plan.speedup,
      agents: plan.agents,
      tokensFullRepo: plan.tokensFullRepo,
      tokensWithPacks: plan.tokensWithPacks,
      totalCostUsd: plan.totalCostUsd,
      criticalPath: report.criticalPath,
    },
  });
  emit({ type: "done", data: report });
}
