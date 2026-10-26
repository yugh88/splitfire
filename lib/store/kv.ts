import { Redis } from "@upstash/redis";

/** Minimal key-value store: Upstash Redis when configured, in-memory otherwise (local dev). */
export type KV = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /** Atomic increment; sets the TTL when the key is first created. Returns the new value. */
  incrBy(key: string, amount: number, ttlSeconds?: number): Promise<number>;
};

// On globalThis so route handlers and pages (separate bundles in Next.js) share one store.
const holder = globalThis as typeof globalThis & { __splitfireKv?: KV };

export function kv(): KV {
  const configured = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  holder.__splitfireKv ??= configured ? upstash() : memory();
  return holder.__splitfireKv;
}

function upstash(): KV {
  const redis = Redis.fromEnv();
  return {
    get: (key) => redis.get(key),
    set: async (key, value, ttlSeconds) => {
      await (ttlSeconds ? redis.set(key, value, { ex: ttlSeconds }) : redis.set(key, value));
    },
    incrBy: async (key, amount, ttlSeconds) => {
      const value = await redis.incrbyfloat(key, amount);
      if (ttlSeconds && value === amount) await redis.expire(key, ttlSeconds);
      return value;
    },
  };
}

export function memory(): KV {
  const data = new Map<string, { value: unknown; expires: number }>();
  const live = (key: string) => {
    const hit = data.get(key);
    return hit && hit.expires >= Date.now() ? hit : undefined;
  };
  return {
    get: async <T>(key: string) => (live(key)?.value as T | undefined) ?? null,
    set: async (key, value, ttlSeconds) => {
      data.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity });
    },
    incrBy: async (key, amount, ttlSeconds) => {
      const hit = live(key);
      const value = (typeof hit?.value === "number" ? hit.value : 0) + amount;
      const expires = hit?.expires ?? (ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity);
      data.set(key, { value, expires });
      return value;
    },
  };
}
