import type { RepoAnalysis } from "@/lib/analyze/load";
import { acceptanceChecks } from "@/lib/context/acceptance";
import { withContextPacks } from "@/lib/context/pack";
import { contextTokens, estimateTask, round } from "@/lib/cost/estimate";
import { estimateTokens } from "@/lib/cost/pricing";
import type { Config } from "@/lib/env";
import type { Partition } from "@/lib/partition";
import { insertContracts } from "@/lib/partition/contracts";
import type { DraftTask } from "@/lib/partition/ownership";
import type { Repair } from "@/lib/partition/repairs";
import { schedule } from "@/lib/partition/schedule";
import type { Plan, Task } from "@/lib/types";
import type { Metrics } from "./events";

/**
 * Turns partitioned tasks into the final plan: context packs, model + cost estimates, acceptance
 * checks and schedule. Contracts-first is applied only when it shortens the parallel time.
 */
export function assemblePlan(args: {
  id: string;
  analysis: RepoAnalysis;
  request: string;
  partition: Partition;
  agents: number;
  cfg: Config;
}): { plan: Plan; metrics: Metrics; repairs: Repair[] } {
  const { analysis, partition, cfg } = args;
  const bytes = new Map(analysis.files.map((f) => [f.path, f.bytes]));
  const existing = new Set(analysis.files.map((f) => f.path));

  const build = (drafts: DraftTask[]) => {
    const tasks: Task[] = withContextPacks(drafts, analysis.edges).map((t) => ({
      ...t,
      ...estimateTask(t, bytes, cfg),
      acceptance: acceptanceChecks(t, analysis.tooling, existing),
    }));
    return { tasks, schedule: schedule(tasks, args.agents) };
  };

  let chosen = build(partition.tasks);
  let repairs = partition.repairs;
  const contracts = insertContracts(partition.tasks, analysis.edges, bytes);
  if (contracts.inserted) {
    const alternative = build(contracts.tasks);
    if (alternative.schedule.parallelMinutes < chosen.schedule.parallelMinutes) {
      chosen = alternative;
      repairs = [...repairs, ...contracts.repairs];
    }
  }

  const { tasks, schedule: s } = chosen;
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
    repairs,
  };
}
