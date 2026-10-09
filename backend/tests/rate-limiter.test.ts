import { afterEach, describe, expect, it, vi } from "vitest";

import { createRateLimiter, type RateLimitStore } from "../src/lib/rate-limiter.js";

afterEach(() => vi.useRealTimers());

describe("single-instance rate limit fallback", () => {
  it("enforces the exact rolling window during an outage and expires admissions", async () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ consumeRateLimit: async () => { throw new Error("Redis unavailable"); } });
    expect((await limiter.consume("messages", "user", 2, 10_000)).allowed).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect((await limiter.consume("messages", "user", 2, 10_000)).allowed).toBe(true);
    expect(await limiter.consume("messages", "user", 2, 10_000)).toEqual({ allowed: false, retryAfterMs: 9_000 });
    await vi.advanceTimersByTimeAsync(9_000);
    expect((await limiter.consume("messages", "user", 2, 10_000)).allowed).toBe(true);
    expect((await limiter.consume("messages", "user", 2, 10_000)).allowed).toBe(false);
  });

  it("preserves recent usage when Redis fails and resumes using Redis after recovery", async () => {
    const consumeRateLimit = vi.fn()
      .mockResolvedValueOnce({ allowed: true, retryAfterMs: 0 })
      .mockRejectedValueOnce(new Error("Redis disconnected"))
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 5_000 });
    const limiter = createRateLimiter({ consumeRateLimit });
    expect((await limiter.consume("messages", "user", 1, 10_000)).allowed).toBe(true);
    expect((await limiter.consume("messages", "user", 1, 10_000)).allowed).toBe(false);
    expect(await limiter.consume("messages", "user", 1, 10_000)).toEqual({ allowed: false, retryAfterMs: 5_000 });
  });

  it("keeps scopes, identities, and windows isolated without storing raw identity data in Redis keys", async () => {
    const consumeRateLimit = vi.fn<RateLimitStore["consumeRateLimit"]>().mockResolvedValue({ allowed: true, retryAfterMs: 0 });
    const limiter = createRateLimiter({ consumeRateLimit });
    await limiter.consume("signin", "private@example.com", 5, 60_000);
    expect(consumeRateLimit.mock.calls[0]?.[0]).not.toContain("private@example.com");
    const fallback = createRateLimiter();
    expect((await fallback.consume("signin", "one", 1, 60_000)).allowed).toBe(true);
    expect((await fallback.consume("signin", "one", 1, 60_000)).allowed).toBe(false);
    expect((await fallback.consume("signup", "one", 1, 60_000)).allowed).toBe(true);
    expect((await fallback.consume("signin", "two", 1, 60_000)).allowed).toBe(true);
  });
});
