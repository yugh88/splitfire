import { costUsd } from "@/lib/cost/pricing";
import type { Config } from "@/lib/env";
import type { KV } from "@/lib/store/kv";

export const DOWNGRADE_AT = 0.9;

export type CallCheck =
  | { ok: true; estimateUsd: number }
  | { ok: false; reason: "budget_exhausted" | "plan_cap" | "no_price" };

/** Picks the planner model for the current total spend; null once the budget is used up. */
export function modelForSpend(totalSpentUsd: number, cfg: Config): string | null {
  if (totalSpentUsd >= cfg.creditBudgetUsd) return null;
  if (totalSpentUsd >= cfg.creditBudgetUsd * DOWNGRADE_AT) return cfg.fastModel;
  return cfg.plannerModel;
}

/** Pre-call guard: blocks any call whose worst-case cost would break the plan or total cap. */
export function checkCall(
  args: {
    model: string;
    inputTokens: number;
    maxOutputTokens: number;
    planSpentUsd: number;
    totalSpentUsd: number;
  },
  cfg: Config,
): CallCheck {
  const price = cfg.prices[args.model];
  if (!price) return { ok: false, reason: "no_price" };
  const estimateUsd = costUsd(price, args.inputTokens, args.maxOutputTokens);
  if (args.totalSpentUsd + estimateUsd > cfg.creditBudgetUsd) {
    return { ok: false, reason: "budget_exhausted" };
  }
  if (args.planSpentUsd + estimateUsd > cfg.planMaxCostUsd)
    return { ok: false, reason: "plan_cap" };
  return { ok: true, estimateUsd };
}

export async function totalSpend(store: KV): Promise<number> {
  return (await store.get<number>("spend:total")) ?? 0;
}

/** Adds real usage to the running totals with atomic increments. Returns the new total. */
export async function recordSpend(store: KV, usd: number, now = new Date()): Promise<number> {
  if (usd <= 0) return totalSpend(store);
  const day = now.toISOString().slice(0, 10);
  const [total] = await Promise.all([
    store.incrBy("spend:total", usd),
    store.incrBy(`spend:day:${day}`, usd, 3 * 24 * 3600),
  ]);
  return total;
}
