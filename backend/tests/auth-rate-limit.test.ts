import type { PrismaClient } from "@prisma/client";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLoginProtection } from "../src/lib/login-protection.js";
import { createLogger } from "../src/lib/logger.js";
import { createRateLimiter } from "../src/lib/rate-limiter.js";
import { createErrorHandler } from "../src/middleware/error-handler.js";
import { createAuthRouter } from "../src/modules/auth/auth.routes.js";

const email = "mina@relay.test";
const password = "fixture-password";
const hash = "scrypt:fixture-salt:4pQaa_CKalL6Q4bPbHT4x35abAiRR9_ZKDvGYTL98TUwWrmi9sWuedtBiTajBm5b_DJ4aJcNLah11J9_4yzeow";

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const findUnique = vi.fn(async () => ({
    userId: "user-1", password: hash,
    user: { id: "user-1", email, name: "Mina", image: null, emailVerified: true, createdAt: new Date() },
  }));
  const prisma = { account: { findUnique }, session: { create: vi.fn(async () => ({})) } } as unknown as PrismaClient;
  const app = express();
  const limiter = createRateLimiter();
  app.use(express.json());
  app.use((req, _res, next) => { req.rateLimiter = limiter; next(); });
  app.use("/api/auth", createAuthRouter(prisma, { NODE_ENV: "test", UPLOAD_DIR: "./storage/uploads" }, createLoginProtection()));
  app.use(createErrorHandler(createLogger({ LOG_LEVEL: "fatal" })));
  return { app, findUnique };
}

describe("sign-in HTTP limits", () => {
  it("allows repeated valid sign-ins rather than blocking after five requests", async () => {
    const { app } = fixture();
    for (let index = 0; index < 12; index++) {
      await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
    }
  });

  it("returns a short Retry-After, skips hashing during cooldown, and resets after success", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { app, findUnique } = fixture();
    for (let index = 0; index < 5; index++) {
      const response = await request(app).post("/api/auth/signin").send({ email, password: "incorrect" }).expect(401);
      expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
    }
    const blocked = await request(app).post("/api/auth/signin").send({ email, password }).expect(429);
    expect(blocked.headers["retry-after"]).toBe("1");
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(findUnique).toHaveBeenCalledTimes(5);
    await request(app).post("/api/auth/signin").send({ email: "teammate@relay.test", password }).expect(200);
    now += 1_000;
    await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
    for (let index = 0; index < 4; index++) await request(app).post("/api/auth/signin").send({ email, password: "incorrect" }).expect(401);
    await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
  });

  it("limits malformed requests separately without treating them as incorrect passwords", async () => {
    const { app, findUnique } = fixture();
    for (let index = 0; index < 99; index++) await request(app).post("/api/auth/signin").send({}).expect(400);
    expect(findUnique).not.toHaveBeenCalled();
    await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
    const blocked = await request(app).post("/api/auth/signin").send({ email, password }).expect(429);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("does not charge failed-credential budgets for database failures", async () => {
    const { app, findUnique } = fixture();
    findUnique.mockRejectedValue(new Error("database unavailable"));
    for (let index = 0; index < 6; index++) await request(app).post("/api/auth/signin").send({ email, password }).expect(500);
    findUnique.mockResolvedValue({ userId: "user-1", password: hash, user: { id: "user-1", email, name: "Mina", image: null, emailVerified: true, createdAt: new Date() } });
    await request(app).post("/api/auth/signin").send({ email, password }).expect(200);
  });
});
