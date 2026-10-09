import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src/lib/logger.js";
import { createErrorHandler } from "../src/middleware/error-handler.js";
import { createOriginGuard } from "../src/middleware/origin-guard.js";

const WEB_ORIGIN = "https://relay.example.com";
const logger = createLogger({ LOG_LEVEL: "fatal" });

function app() {
  const application = express();
  application.use(express.json());
  application.use(createOriginGuard(WEB_ORIGIN));
  application.post("/mutate", (_req, res) => res.sendStatus(204));
  application.get("/read", (_req, res) => res.sendStatus(204));
  application.use(createErrorHandler(logger));
  return application;
}

describe("origin guard", () => {
  it("allows safe methods regardless of origin", async () => {
    await request(app()).get("/read").set("Origin", "https://evil.example").expect(204);
  });

  it("allows a matching origin and non-browser clients without origin evidence", async () => {
    await request(app()).post("/mutate").set("Origin", WEB_ORIGIN).expect(204);
    await request(app()).post("/mutate").expect(204);
  });

  it("rejects cross-origin unsafe requests from any browser signal", async () => {
    await request(app()).post("/mutate").set("Origin", "https://evil.example").expect(403);
    await request(app()).post("/mutate").set("Sec-Fetch-Site", "cross-site").expect(403);
    await request(app()).post("/mutate").set("Referer", "https://evil.example/page").expect(403);
    await request(app()).post("/mutate").set("Referer", "not-a-url").expect(403);
  });

  it("allows same-origin fetch metadata, user-initiated requests, and matching referers", async () => {
    await request(app()).post("/mutate").set("Sec-Fetch-Site", "same-origin").expect(204);
    await request(app()).post("/mutate").set("Sec-Fetch-Site", "same-site").expect(204);
    await request(app()).post("/mutate").set("Sec-Fetch-Site", "none").expect(204);
    await request(app()).post("/mutate").set("Referer", `${WEB_ORIGIN}/app`).expect(204);
  });

  it("returns the stable error envelope without leaking detail", async () => {
    const denied = await request(app()).post("/mutate").set("Origin", "https://evil.example").expect(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");
  });
});
