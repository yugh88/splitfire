import type { RepoAnalysis } from "@/lib/analyze/load";
import { costUsd, estimateTokens } from "@/lib/cost/pricing";
import type { Config, Endpoint } from "@/lib/env";
import { isAcyclic } from "@/lib/partition/dag";
import { normalizeProposals } from "@/lib/partition/ownership";
import type { KV } from "@/lib/store/kv";
import { checkCall, modelForSpend, recordSpend, totalSpend } from "./budget";
import { deterministicProposals } from "./deterministic";
import type { PlannerKind } from "./events";
import { streamTaskProposals, type LlmResult } from "./llm";
import { mockProposals } from "./mock";
import { buildPrompt, MAX_OUTPUT_TOKENS, SYSTEM_PROMPT } from "./prompt";
import type { TaskProposal } from "./schema";

export const BUDGET_NOTICE = "demo budget reached";
export const NO_MODEL_NOTICE = "no model configured";

const PLANNING_DEADLINE_MS = 240_000;
const CALL_TIMEOUT_MS = 120_000;
const MIN_ATTEMPT_MS = 20_000;

/** True when at least one endpoint and model name are set. */
export function llmConfigured(cfg: Config): boolean {
  return Boolean((cfg.primary && cfg.plannerModel) || cfg.fallback);
}

export type CallLog = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ok: boolean;
  error?: string;
};

export type PlannerResult = {
  proposals: TaskProposal[];
  planner: PlannerKind;
  notice: string | null;
  calls: CallLog[];
};

type Deps = {
  cfg: Config;
  store: KV;
  /** Streams proposals as they arrive; `attempt` changes when a retry starts over. */
  onTask: (task: TaskProposal, attempt: number) => void;
  callModel?: typeof streamTaskProposals;
  delayMs?: number;
  /** Total time the model attempts may take; keeps the request inside the function limit. */
  deadlineMs?: number;
};

/** Validate → repair → fallback model → deterministic plan. Never throws on bad model output. */
export async function proposeTasks(
  analysis: RepoAnalysis,
  request: string,
  deps: Deps,
): Promise<PlannerResult> {
  const { cfg, store, onTask } = deps;
  const calls: CallLog[] = [];
  const deterministic = (notice: string | null): PlannerResult => {
    const proposals = deterministicProposals(analysis, request);
    proposals.forEach((t) => onTask(t, 0));
    return { proposals, planner: "deterministic", notice, calls };
  };

  if (cfg.mockLlm) {
    const proposals = mockProposals(analysis, request);
    for (const task of proposals) {
      await sleep(deps.delayMs ?? 250);
      onTask(task, 0);
    }
    return { proposals, planner: "mock", notice: null, calls };
  }

  if (!llmConfigured(cfg)) return deterministic(NO_MODEL_NOTICE);
  const spent = await totalSpend(store);
  const model = modelForSpend(spent, cfg);
  if (!model) return deterministic(BUDGET_NOTICE);

  const downgraded = model !== cfg.plannerModel;
  const attempts: { endpoint: Endpoint; model: string; kind: PlannerKind }[] = [];
  if (cfg.primary) attempts.push({ endpoint: cfg.primary, model, kind: "llm" });
  if (cfg.primary) attempts.push({ endpoint: cfg.primary, model, kind: "llm" });
  if (cfg.fallback && !downgraded) {
    attempts.push({ endpoint: cfg.fallback, model: cfg.fallback.model, kind: "fallback" });
  }
  if (attempts.length === 0) return deterministic(NO_MODEL_NOTICE);

  const basePrompt = buildPrompt(analysis, request);
  let lastError: string | null = null;
  let planSpent = 0;
  let total = spent;

  const deadline = Date.now() + (deps.deadlineMs ?? PLANNING_DEADLINE_MS);
  for (const [attempt, target] of attempts.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const prompt = lastError
      ? `${basePrompt}\n\nYour previous answer was rejected: ${lastError}\nReturn corrected JSON only.`
      : basePrompt;
    const inputTokens = estimateTokens(SYSTEM_PROMPT.length + prompt.length);
    const check = checkCall(
      {
        model: target.model,
        inputTokens,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        planSpentUsd: planSpent,
        totalSpentUsd: total,
      },
      cfg,
    );
    if (!check.ok) {
      if (check.reason === "no_price") {
        console.warn(`[splitfire] no price for model ${target.model}; skipping call`);
        continue;
      }
      return deterministic(BUDGET_NOTICE);
    }

    const result = await (deps.callModel ?? streamTaskProposals)({
      endpoint: target.endpoint,
      model: target.model,
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: Math.min(CALL_TIMEOUT_MS, remaining),
      onTask: (task) => onTask(task, attempt + 1),
    });

    const usage = result.usage ?? { inputTokens, outputTokens: MAX_OUTPUT_TOKENS };
    const price = cfg.prices[target.model];
    const cost = price ? costUsd(price, usage.inputTokens, usage.outputTokens) : 0;
    planSpent += cost;
    total = await recordSpend(store, cost);

    const error = validationError(result);
    calls.push({
      model: target.model,
      ...usage,
      costUsd: cost,
      ok: !error,
      ...(error ? { error } : {}),
    });
    console.info(
      `[splitfire] llm ${target.model} in=${usage.inputTokens} out=${usage.outputTokens} cost=$${cost.toFixed(4)} credits used=$${total.toFixed(4)}/${cfg.creditBudgetUsd}`,
    );
    if (!error && result.ok)
      return { proposals: result.tasks, planner: target.kind, notice: null, calls };
    lastError = error;
  }

  return deterministic(null);
}

/** Zod already passed inside llm.ts; this adds the DAG check. Overlaps are repaired, not rejected. */
function validationError(result: LlmResult): string | null {
  if (!result.ok) return result.error;
  if (!isAcyclic(normalizeProposals(result.tasks))) return "dependsOn contains a cycle";
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
