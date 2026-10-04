import { afterAll, describe, expect, it } from "vitest";

import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { createRedisConnection } from "../../src/lib/redis.js";

const database = createDatabase(
  process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay",
);
const redis = createRedisConnection(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  createLogger({ LOG_LEVEL: "fatal" }),
);

afterAll(async () => {
  await Promise.allSettled([database.disconnect(), redis.disconnect()]);
});

describe("infrastructure dependencies", () => {
  it("connects to PostgreSQL through Prisma", async () => {
    await database.connect();
    await expect(database.probe()).resolves.toBe(true);
  });

  it("connects to Redis", async () => {
    await redis.connect();
    await expect(redis.probe()).resolves.toBe(true);
  });
});
