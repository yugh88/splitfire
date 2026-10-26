import type { Config } from "@/lib/env";
import type { DraftTask } from "@/lib/partition/ownership";
import type { Task } from "@/lib/types";
import { costUsd, estimateTokens } from "./pricing";

export type Estimate = Pick<Task, "model" | "estTokens" | "estCostUsd" | "estMinutes">;

const BRIEF_TOKENS = 800;
const NEW_FILE_OUTPUT_TOKENS = 600;
const TURNS: Record<Task["difficulty"], number> = { 1: 3, 2: 5, 3: 8 };
const BASE_MINUTES: Record<Task["difficulty"], number> = { 1: 8, 2: 15, 3: 25 };

/** Small model for easy tasks, strong model for hard ones. */
export function routeModel(difficulty: Task["difficulty"], cfg: Config): string {
  return difficulty >= 3 ? cfg.plannerModel || "strong-model" : cfg.fastModel || "fast-model";
}

/** Tokens an agent reads for this task: its files plus the brief. */
export function contextTokens(
  task: Pick<DraftTask, "ownedFiles" | "readFiles">,
  bytes: Map<string, number>,
) {
  const files = new Set([...task.ownedFiles, ...task.readFiles]);
  let chars = 0;
  for (const f of files) chars += bytes.get(f) ?? 0;
  return estimateTokens(chars) + BRIEF_TOKENS;
}

export function estimateTask(task: DraftTask, bytes: Map<string, number>, cfg: Config): Estimate {
  const model = routeModel(task.difficulty, cfg);
  const input = contextTokens(task, bytes) * TURNS[task.difficulty];
  const output = task.ownedFiles.reduce((sum, f) => {
    const size = bytes.get(f);
    return (
      sum + (size === undefined ? NEW_FILE_OUTPUT_TOKENS : Math.ceil(estimateTokens(size) / 2))
    );
  }, 0);
  const price = cfg.prices[model];
  return {
    model,
    estTokens: input + output,
    estCostUsd: price ? round(costUsd(price, input, output), 4) : 0,
    estMinutes: BASE_MINUTES[task.difficulty] + 3 * task.ownedFiles.length,
  };
}

export function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
