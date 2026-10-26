import { z } from "zod";

const PriceSchema = z.object({ input: z.number().nonnegative(), output: z.number().nonnegative() });
const PricesSchema = z.record(z.string(), PriceSchema);

/** USD per 1M tokens. */
export type Price = z.infer<typeof PriceSchema>;

export type Endpoint = { name: string; baseURL: string; apiKey: string };

export type Config = {
  primary: Endpoint | null;
  fallback: (Endpoint & { model: string }) | null;
  plannerModel: string;
  fastModel: string;
  prices: Record<string, Price>;
  creditBudgetUsd: number;
  planMaxCostUsd: number;
  mockLlm: boolean;
  githubToken: string | undefined;
};

let cached: Config | null = null;

/** All env access goes through here. Invalid values fall back to safe defaults. */
export function config(env: Record<string, string | undefined> = process.env): Config {
  if (env === process.env && cached) return cached;
  const result: Config = {
    primary: endpoint("primary", env.OPENMODEL_BASE_URL, env.OPENMODEL_API_KEY),
    fallback: withModel(
      endpoint("fallback", env.FALLBACK_BASE_URL, env.FALLBACK_API_KEY),
      env.FALLBACK_MODEL,
    ),
    plannerModel: env.PLANNER_MODEL ?? "",
    fastModel: env.FAST_MODEL ?? env.PLANNER_MODEL ?? "",
    prices: parsePrices(env.MODEL_PRICES_JSON),
    creditBudgetUsd: positive(env.CREDIT_BUDGET_USD, 5),
    planMaxCostUsd: positive(env.PLAN_MAX_COST_USD, 0.05),
    mockLlm: env.MOCK_LLM === "1",
    githubToken: env.GITHUB_TOKEN || undefined,
  };
  if (env === process.env) cached = result;
  return result;
}

function endpoint(name: string, baseURL?: string, apiKey?: string): Endpoint | null {
  return baseURL && apiKey ? { name, baseURL, apiKey } : null;
}

function withModel(e: Endpoint | null, model?: string) {
  return e && model ? { ...e, model } : null;
}

function parsePrices(raw?: string): Record<string, Price> {
  if (!raw) return {};
  try {
    return PricesSchema.parse(JSON.parse(raw));
  } catch {
    console.warn("[splitfire] MODEL_PRICES_JSON is invalid; LLM calls will be blocked");
    return {};
  }
}

function positive(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && Number.isFinite(n) && n >= 0 ? n : fallback;
}
