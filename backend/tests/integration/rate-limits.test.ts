import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLogger } from "../../src/lib/logger.js";
import { createRateLimiter } from "../../src/lib/rate-limiter.js";
import { createRedisConnection } from "../../src/lib/redis.js";
import { createRequestRateLimit } from "../../src/middleware/rate-limit.js";
import { createErrorHandler } from "../../src/middleware/error-handler.js";

const logger = createLogger({ LOG_LEVEL: "fatal" });
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const first = createRedisConnection(redisUrl, logger);
const second = createRedisConnection(redisUrl, logger);

beforeAll(async () => { await Promise.all([first.connect(), second.connect()]); });
afterAll(async () => { await Promise.all([first.disconnect(), second.disconnect()]); });

describe("Redis-backed rate limits", () => {
  it("atomically admits exactly the configured budget across independent API instances", async () => {
    const identity = randomUUID();
    const limiters = [createRateLimiter(first), createRateLimiter(second)];
    const outcomes = await Promise.all(Array.from({ length: 40 }, (_, index) => limiters[index % 2]!.consume("concurrency-test", identity, 10, 1_000)));
    expect(outcomes.filter((result) => result.allowed)).toHaveLength(10);
    expect(outcomes.filter((result) => !result.allowed).every((result) => result.retryAfterMs > 0)).toBe(true);
    await expect.poll(async () => (await limiters[1]!.consume("concurrency-test", identity, 10, 1_000)).allowed, { timeout: 3_000 }).toBe(true);
  });

  it("shares HTTP route budgets across separate apps and returns Retry-After", async () => {
    const identity = randomUUID();
    const apps = [first, second].map((store) => {
      const app = express();
      const limiter = createRateLimiter(store);
      app.use((req, _res, next) => { req.rateLimiter = limiter; next(); });
      app.use(createRequestRateLimit(2, 10_000, () => identity, "RATE_LIMITED", "two-app-test"));
      app.get("/example", (_req, res) => res.sendStatus(204));
      app.use(createErrorHandler(logger));
      return app;
    });
    await request(apps[0]).get("/example").expect(204);
    await request(apps[1]).get("/example").expect(204);
    const denied = await request(apps[0]).get("/example").expect(429);
    expect(denied.body.error.code).toBe("RATE_LIMITED");
    expect(Number(denied.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("continues bounded local protection when a real Redis connection is lost", async () => {
    const connection = createRedisConnection(redisUrl, logger);
    await connection.connect();
    try {
      const limiter = createRateLimiter(connection);
      const identity = randomUUID();
      expect((await limiter.consume("outage-test", identity, 2, 10_000)).allowed).toBe(true);
      await connection.disconnect();
      expect((await limiter.consume("outage-test", identity, 2, 10_000)).allowed).toBe(true);
      expect((await limiter.consume("outage-test", identity, 2, 10_000)).allowed).toBe(false);
      expect(await connection.probe()).toBe(false);
      await connection.connect();
      expect((await limiter.consume("outage-test", identity, 2, 10_000)).allowed).toBe(false);
      expect(await connection.probe()).toBe(true);
    } finally {
      // disconnect is safe after an already-closed connection.
      await connection.disconnect();
    }
  });
});
