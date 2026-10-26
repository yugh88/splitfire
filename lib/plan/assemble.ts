import type { RepoAnalysis } from "@/lib/analyze/load";
import { contextTokens, estimateTask, round } from "@/lib/cost/estimate";
import { estimateTokens } from "@/lib/cost/pricing";
import type { Config } from "@/lib/env";
import type { Partition } from "@/lib/partition";
import { schedule } from "@/lib/partition/schedule";
import type { Plan, Task } from "@/lib/types";
import type { Metrics } from "./events";

/** Attaches estimates to partitioned tasks and computes plan-level metrics. */
export function assemblePlan(args: {
  id: string;
  analysis: RepoAnalysis;
  request: string;
  partition: Partition;
  cfg: Config;
}): { plan: Plan; metrics: Metrics } {
  const { analysis, partition, cfg } = args;
  const bytes = new Map(analysis.files.map((f) => [f.path, f.bytes]));
  const tasks: Task[] = partition.tasks.map((t) => ({
    ...t,
    ...estimateTask(t, bytes, cfg),
    acceptance: [],
  }));

  const s = schedule(tasks);
  const repoTokens = estimateTokens(analysis.files.reduce((n, f) => n + f.bytes, 0));
  const planMetrics = {
    collisionScore: partition.collisionScore,
    serialMinutes: s.serialMinutes,
    parallelMinutes: s.parallelMinutes,
    speedup: s.speedup,
    agents: s.agents,
    tokensFullRepo: repoTokens * tasks.length,
    tokensWithPacks: tasks.reduce((n, t) => n + contextTokens(t, bytes), 0),
    totalCostUsd: round(
      tasks.reduce((n, t) => n + t.estCostUsd, 0),
      4,
    ),
  };

  return {
    plan: {
      id: args.id,
      repo: analysis.repo,
      sha: analysis.sha,
      request: args.request,
      tasks,
      ...planMetrics,
    },
    metrics: { ...planMetrics, criticalPath: s.criticalPath },
  };
}
