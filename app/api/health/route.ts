import { config } from "@/lib/env";
import { DOWNGRADE_AT, totalSpend } from "@/lib/plan/budget";
import { kv } from "@/lib/store/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Spend vs. budget. Numbers only, never secrets. */
export async function GET() {
  const cfg = config();
  const spent = await totalSpend(kv());
  const ratio = cfg.creditBudgetUsd > 0 ? spent / cfg.creditBudgetUsd : 1;
  return Response.json({
    ok: true,
    spendUsd: Math.round(spent * 10_000) / 10_000,
    budgetUsd: cfg.creditBudgetUsd,
    planMaxCostUsd: cfg.planMaxCostUsd,
    mode: cfg.mockLlm
      ? "mock"
      : ratio >= 1
        ? "deterministic"
        : ratio >= DOWNGRADE_AT
          ? "fast-model"
          : "normal",
  });
}
