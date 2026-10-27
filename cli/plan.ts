import type { RepoAnalysis } from "@/lib/analyze/load";
import { loadRepoAnalysis } from "@/lib/analyze/load";
import type { Config } from "@/lib/env";
import { IngestError } from "@/lib/ingest/github";
import { parseRepoUrl } from "@/lib/ingest/repo-url";
import { assemblePlan } from "@/lib/plan/assemble";
import { deterministicProposals } from "@/lib/plan/deterministic";
import { NO_MODEL_NOTICE, llmConfigured, proposeTasks } from "@/lib/plan/planner";
import { planId } from "@/lib/plan/pipeline";
import type { TaskProposal } from "@/lib/plan/schema";
import { partition } from "@/lib/partition";
import type { Repair } from "@/lib/partition/repairs";
import { memory } from "@/lib/store/kv";
import type { Plan } from "@/lib/types";
import { CliError } from "./errors";
import { loadLocalAnalysis } from "./local";
import { GATES_PATH, outRelativeTo } from "./pack";

export type PlanMode = "local" | "remote";

export const MODEL_UNAVAILABLE_NOTICE = "model unavailable";

export type AnalysisResult = { analysis: RepoAnalysis; mode: PlanMode };

/** Loads a local working tree (default) or a GitHub repo via `--repo`, reusing the web ingest. */
export async function loadAnalysis(opts: {
  repo?: string;
  cwd: string;
  out: string;
  cfg: Config;
}): Promise<AnalysisResult> {
  if (opts.repo) {
    const ref = parseRepoUrl(opts.repo);
    if (!ref) {
      throw new CliError("--repo needs a GitHub URL or owner/name, for example yugh88/splitfire.");
    }
    try {
      const { analysis } = await loadRepoAnalysis(ref, {
        token: opts.cfg.githubToken,
        store: memory(),
      });
      return { analysis, mode: "remote" };
    } catch (error) {
      if (error instanceof IngestError) throw new CliError(error.message);
      throw error;
    }
  }

  const outDir = outRelativeTo(opts.cwd, opts.out);
  const skipDirs = [".splitfire", ".git", outDir].filter((dir): dir is string => Boolean(dir));
  const { analysis } = await loadLocalAnalysis(opts.cwd, { skipDirs, skipFiles: [GATES_PATH] });
  return { analysis, mode: "local" };
}

export type PlanningResult = {
  plan: Plan;
  planner: "llm" | "fallback" | "deterministic" | "mock";
  notice: string | null;
  collisionScoreBefore: number;
  repairs: Repair[];
};

export type PlanningInput = {
  analysis: RepoAnalysis;
  request: string;
  agents: number;
  offline: boolean;
  mock: boolean;
  cfg: Config;
  /** Called once, before the first model request, with the model name. */
  onModelCall?: (model: string) => void;
  onProposal?: (task: TaskProposal) => void;
  onNotice?: (message: string) => void;
};

/**
 * Proposes tasks, then runs the same deterministic partitioner and assembler as the web app.
 * `--offline`, `--mock` and a missing model config all land on the deterministic planner.
 */
export async function buildPlan(input: PlanningInput): Promise<PlanningResult> {
  const { analysis, request, cfg } = input;
  const deterministic = input.offline || input.mock || !llmConfigured(cfg);

  let proposals: TaskProposal[];
  let planner: PlanningResult["planner"];
  let notice: string | null;

  if (deterministic) {
    proposals = deterministicProposals(analysis, request);
    proposals.forEach((task) => input.onProposal?.(task));
    planner = "deterministic";
    notice = input.offline || input.mock ? null : NO_MODEL_NOTICE;
  } else {
    input.onModelCall?.(cfg.plannerModel || cfg.fastModel || "model");
    const result = await proposeTasks(modelSafe(analysis), request, {
      cfg,
      store: memory(),
      onTask: (task) => input.onProposal?.(task),
    });
    proposals = result.proposals;
    planner = result.planner;
    notice = result.notice;
    if (planner === "deterministic" && result.calls.length === 0 && notice === null) {
      notice = MODEL_UNAVAILABLE_NOTICE;
    }
    if (planner === "deterministic" && result.calls.some((call) => !call.ok)) {
      const failure = result.calls.find((call) => !call.ok)?.error;
      input.onNotice?.(
        failure
          ? `Model output was rejected (${failure}); used the deterministic planner.`
          : "Model produced no usable plan; used the deterministic planner.",
      );
    }
  }

  const parts = partition(proposals, analysis.edges);
  const { plan, repairs } = assemblePlan({
    id: planId(analysis.repo, analysis.sha, request, input.agents),
    analysis,
    request,
    partition: parts,
    agents: input.agents,
    cfg,
  });

  return {
    plan,
    planner,
    notice,
    collisionScoreBefore: parts.collisionScoreBefore,
    repairs,
  };
}

/**
 * Local mode privacy: the planner only ever sees paths, the import graph and the request.
 * Export names are derived from source, so they are removed, and sizes are zeroed rather than
 * sent as a side channel about file contents.
 */
export function modelSafe(analysis: RepoAnalysis): RepoAnalysis {
  return {
    ...analysis,
    symbols: {},
    files: analysis.files.map((file) => ({ ...file, bytes: 0 })),
  };
}
