import request from "supertest";
import { describe, expect, it } from "vitest";
import express from "express";

import { createApp } from "../src/app.js";
import type { Environment } from "../src/config/env.js";
import { ApiError } from "../src/lib/api-error.js";
import type { DependencyProbe } from "../src/lib/database.js";
import { createLogger } from "../src/lib/logger.js";
import { createErrorHandler } from "../src/middleware/error-handler.js";

const environment: Environment = {
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-32-characters",
  DATABASE_URL: "postgresql://relay:relay@localhost:5432/relay",
  REDIS_URL: "redis://localhost:6379",
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  EMAIL_FROM: "Relay <no-reply@relay.local>",
  UPLOAD_DIR: "./storage/uploads",
  LOG_LEVEL: "fatal",
  TRUST_PROXY: false,
};

const available: DependencyProbe = { probe: async () => true };
const unavailable: DependencyProbe = { probe: async () => false };
const failing: DependencyProbe = { probe: async () => Promise.reject(new Error("probe failed")) };

describe("health routes", () => {
  it("reports process liveness", async () => {
    const app = createApp(environment, { database: available, redis: available }, createLogger(environment));
    const response = await request(app).get("/api/health/live").expect(200);

    expect(response.body).toMatchObject({ service: "relay-api", status: "ok" });
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
  });

  it("reports Redis failure as degraded without failing readiness", async () => {
    const app = createApp(
      environment,
      { database: available, redis: unavailable },
      createLogger(environment),
    );
    const response = await request(app).get("/api/health/ready").expect(200);

    expect(response.body).toMatchObject({
      status: "degraded",
      checks: { postgres: { status: "ok" }, redis: { status: "unavailable" } },
    });
  });

  it("fails readiness when PostgreSQL is unavailable", async () => {
    const app = createApp(
      environment,
      { database: unavailable, redis: available },
      createLogger(environment),
    );
    const response = await request(app).get("/api/health/ready").expect(503);

    expect(response.body.status).toBe("unavailable");
  });

  it("maps a rejected dependency probe to unavailable", async () => {
    const app = createApp(environment, { database: failing, redis: available }, createLogger(environment));
    const response = await request(app).get("/api/health/ready").expect(503);

    expect(response.body.checks.postgres.status).toBe("unavailable");
  });

  it("returns the stable error envelope for unknown routes", async () => {
    const app = createApp(environment, { database: available, redis: available }, createLogger(environment));
    const response = await request(app).get("/api/missing").expect(404);

    expect(response.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(response.body.error).not.toHaveProperty("message");
  });

  it("does not serialize ApiError messages", async () => {
    const app = express();
    app.get("/api/test", () => {
      throw new ApiError(403, "FORBIDDEN", "Sensitive implementation detail");
    });
    app.use(createErrorHandler(createLogger(environment)));

    const response = await request(app).get("/api/test").expect(403);

    expect(response.body).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(response.body.error).not.toHaveProperty("message");
  });

  it("does not serialize unhandled error details", async () => {
    const app = express();
    app.get("/api/test", () => {
      throw new Error("PrismaClientKnownRequestError: sensitive database detail");
    });
    app.use(createErrorHandler(createLogger(environment)));

    const response = await request(app).get("/api/test").expect(500);

    expect(response.body).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
    expect(response.body.error).not.toHaveProperty("message");
  });
});
