import express from "express";
import request from "supertest";
import { describe, it } from "vitest";

import { createRequestRateLimit, createUserRateLimit } from "../src/middleware/rate-limit.js";

describe("HTTP rate limiting", () => {
  it("shares a user's general limit across different routes", async () => {
    const app = express();
    const userId = crypto.randomUUID();
    app.use((req, _res, next) => {
      req.authUser = { id: userId } as typeof req.authUser;
      next();
    });
    app.use(createUserRateLimit(2, 60_000, "RATE_LIMITED", `general-test-${userId}`));
    app.get("/first", (_req, res) => res.sendStatus(204));
    app.get("/second", (_req, res) => res.sendStatus(204));

    await request(app).get("/first").expect(204);
    await request(app).get("/second").expect(204);
    await request(app).get("/first").expect(429);
  });

  it("limits unauthenticated requests with an explicit IP and identity key", async () => {
    const app = express();
    const scope = `public-test-${crypto.randomUUID()}`;
    app.use(express.json());
    app.post("/signin", createRequestRateLimit(1, 60_000, (req) => `${req.ip}:${String(req.body.email).toLowerCase()}`, "RATE_LIMITED", scope), (_req, res) => res.sendStatus(204));

    await request(app).post("/signin").send({ email: "user@example.com" }).expect(204);
    await request(app).post("/signin").send({ email: "user@example.com" }).expect(429);
    await request(app).post("/signin").send({ email: "other@example.com" }).expect(204);
  });
});
