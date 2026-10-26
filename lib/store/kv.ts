import { Redis } from "@upstash/redis";

/** Minimal key-value store: Upstash Redis when configured, in-memory otherwise (local dev). */
export type KV = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
};

let instance: KV | null = null;

export function kv(): KV {
  instance ??= process.env.UPSTASH_REDIS_REST_URL ? upstash() : memory();
  return instance;
}

function upstash(): KV {
  const redis = Redis.fromEnv();
  return {
    get: (key) => redis.get(key),
    set: async (key, value, ttlSeconds) => {
      await (ttlSeconds ? redis.set(key, value, { ex: ttlSeconds }) : redis.set(key, value));
    },
  };
}

export function memory(): KV {
  const data = new Map<string, { value: unknown; expires: number }>();
  return {
    get: async <T>(key: string) => {
      const hit = data.get(key);
      if (!hit || hit.expires < Date.now()) return null;
      return hit.value as T;
    },
    set: async (key, value, ttlSeconds) => {
      data.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity });
    },
  };
}
