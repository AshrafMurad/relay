import { createHash } from "node:crypto";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export interface RateLimitStore {
  consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

export interface RateLimiter {
  consume(scope: string, identity: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/** One bounded fallback per API instance, shared by HTTP and Socket.IO. */
export function createRateLimiter(store?: RateLimitStore): RateLimiter {
  const hits = new Map<string, { timestamps: number[]; windowMs: number }>();
  const maxKeys = 50_000;
  let nextSweep = 0;

  return {
    async consume(scope, identity, limit, windowMs) {
      const now = Date.now();
      const key = `rate-limit:${createHash("sha256").update(JSON.stringify([scope, identity, limit, windowMs])).digest("hex")}`;
      if (now >= nextSweep) {
        for (const [storedKey, entry] of hits) {
          if (entry.timestamps.at(-1)! <= now - entry.windowMs) hits.delete(storedKey);
        }
        nextSweep = now + 60_000;
      }
      const current = (hits.get(key)?.timestamps ?? []).filter((timestamp) => timestamp > now - windowMs);
      const allowed = current.length < limit && (hits.has(key) || hits.size < maxKeys);
      const local = { allowed, retryAfterMs: allowed ? 0 : Math.max(1, (current[0] ?? now) + windowMs - now) };
      // Mirror local admissions even while Redis is healthy, so an outage cannot
      // immediately reset this instance's recently consumed allowance.
      if (allowed) {
        current.push(now);
        hits.set(key, { timestamps: current, windowMs });
      }
      if (store) {
        try {
          const shared = await store.consumeRateLimit(key, limit, windowMs);
          // Keep outage admissions protected during recovery as well. Redis
          // cannot know about requests admitted by the local fallback.
          return shared.allowed ? local : shared;
        } catch {
          // Redis commands have bounded timeouts and never queue offline.
          // This fallback is only suitable for the single-instance V1 backend.
        }
      }
      return local;
    },
  };
}

export const defaultRateLimiter = createRateLimiter();
