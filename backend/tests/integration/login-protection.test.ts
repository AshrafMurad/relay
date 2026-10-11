import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLoginProtection, type LoginAttempt } from "../../src/lib/login-protection.js";
import { createLogger } from "../../src/lib/logger.js";
import { createRedisConnection } from "../../src/lib/redis.js";

const logger = createLogger({ LOG_LEVEL: "fatal" });
const url = process.env.REDIS_URL ?? "redis://localhost:6379";
const connections = [createRedisConnection(url, logger), createRedisConnection(url, logger)];

beforeAll(async () => { await Promise.all(connections.map((connection) => connection.connect())); });
afterAll(async () => { await Promise.all(connections.map((connection) => connection.disconnect())); });

describe("Redis login protection across API instances", () => {
  it("allows only one simultaneous password check per pair and shares failure cooldowns", async () => {
    const ip = randomUUID();
    const email = `${randomUUID()}@relay.test`;
    const protections = connections.map((connection) => createLoginProtection(connection));
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => protections[index % 2]!.begin(ip, email)));
    expect(results.filter((attempt) => attempt.allowed)).toHaveLength(1);
    await results.find((attempt) => attempt.allowed)!.finish("failure");
    for (let index = 0; index < 4; index++) {
      const attempt = await protections[index % 2]!.begin(ip, email);
      expect(attempt.allowed).toBe(true);
      await attempt.finish("failure");
    }
    for (const protection of protections) {
      const blocked = await protection.begin(ip, email);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterMs).toBeLessThanOrEqual(1_000);
    }
    let retry: LoginAttempt | undefined;
    await expect.poll(async () => {
      retry = await protections[0]!.begin(ip, email);
      return retry.allowed;
    }, { timeout: 3_000 }).toBe(true);
    await retry!.finish("failure");
    const doubled = await protections[1]!.begin(ip, email);
    expect(doubled.allowed).toBe(false);
    expect(doubled.retryAfterMs).toBeGreaterThan(1_000);
    expect(doubled.retryAfterMs).toBeLessThanOrEqual(2_000);
    await expect.poll(async () => {
      retry = await protections[0]!.begin(ip, email);
      return retry.allowed;
    }, { timeout: 4_000 }).toBe(true);
    await retry!.finish("success");
    const next = await protections[1]!.begin(ip, email);
    expect(next.allowed).toBe(true);
    await next.finish("success");
  });

  it("reserves the IP-wide budget atomically, then refunds successful/cancelled attempts", async () => {
    const ip = randomUUID();
    const protections = connections.map((connection) => createLoginProtection(connection));
    const attempts = await Promise.all(Array.from({ length: 70 }, (_, index) => protections[index % 2]!.begin(ip, `${index}@relay.test`)));
    const admitted = attempts.filter((attempt) => attempt.allowed);
    expect(admitted).toHaveLength(50);
    await Promise.all(admitted.map((attempt, index) => attempt.finish(index % 2 ? "success" : "cancelled")));
    for (let index = 0; index < 60; index++) {
      const attempt = await protections[index % 2]!.begin(ip, "valid@relay.test");
      expect(attempt.allowed).toBe(true);
      await attempt.finish("success");
    }
  });

  it("retains a shared IP failure budget across different accounts and normalizes pair identities", async () => {
    const ip = randomUUID();
    const protections = connections.map((connection) => createLoginProtection(connection));
    for (let index = 0; index < 50; index++) {
      const attempt = await protections[index % 2]!.begin(ip, `${index}@relay.test`);
      expect(attempt.allowed).toBe(true);
      await attempt.finish("failure");
    }
    expect((await protections[1]!.begin(ip, "new@relay.test")).allowed).toBe(false);
    const other = await protections[1]!.begin(randomUUID(), "new@relay.test");
    expect(other.allowed).toBe(true);
    await other.finish("cancelled");

    const otherIp = randomUUID();
    const pending = await protections[0]!.begin(otherIp, " USER@Relay.Test ");
    expect((await protections[1]!.begin(otherIp, "user@relay.test")).allowed).toBe(false);
    await pending.finish("cancelled");
  });

  it("keeps local failures protected through real Redis disconnection and recovery", async () => {
    const connection = createRedisConnection(url, logger);
    await connection.connect();
    try {
      const ip = randomUUID();
      const protection = createLoginProtection(connection);
      for (let index = 0; index < 4; index++) await (await protection.begin(ip, "user@relay.test")).finish("failure");
      await connection.disconnect();
      await (await protection.begin(ip, "user@relay.test")).finish("failure");
      expect((await protection.begin(ip, "user@relay.test")).allowed).toBe(false);
      await connection.connect();
      expect((await protection.begin(ip, "user@relay.test")).allowed).toBe(false);
    } finally {
      await connection.disconnect();
    }
  });
});
