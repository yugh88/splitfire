import type { KV } from "./kv";

export const PLANS_PER_HOUR = 5;

/** Fixed one-hour window per IP. Returns false once the limit is exceeded. */
export async function allowPlan(store: KV, ip: string, now = Date.now()): Promise<boolean> {
  const window = Math.floor(now / 3_600_000);
  const count = await store.incrBy(`ratelimit:${ip}:${window}`, 1, 3_600);
  return count <= PLANS_PER_HOUR;
}
