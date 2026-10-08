import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import { io as createClient } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { createSocketServer } from "../../src/realtime/socket-server.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const environment: Environment = {
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-32-characters",
  DATABASE_URL: databaseUrl,
  REDIS_URL: "redis://localhost:6379",
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  EMAIL_FROM: "Relay <no-reply@relay.local>",
  UPLOAD_DIR: "./storage/uploads",
  LOG_LEVEL: "fatal",
  TRUST_PROXY: false,
};
const email = `session-${randomUUID()}@relay.test`;
const password = "session-password";
let userId = "";
let cookie = "";
let httpServer: HttpServer;
let io: ReturnType<typeof createSocketServer>;
let url = "";

beforeAll(async () => {
  await database.connect();
  const logger = createLogger(environment);
  const app = createApp(environment, { database, redis: { probe: async () => true } }, logger);
  httpServer = createServer(app);
  io = createSocketServer(httpServer, environment, logger, database.prisma);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port");
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (userId) await database.prisma.user.deleteMany({ where: { id: userId } });
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await database.disconnect();
});

function connect(sessionCookie: string) {
  return createClient(url, { autoConnect: false, extraHeaders: { Origin: environment.WEB_ORIGIN, Cookie: sessionCookie }, reconnection: false });
}

describe("authentication sessions", () => {
  it("creates an opaque session and refreshes it at most once per day", async () => {
    const signup = await request(httpServer).post("/api/auth/signup").send({ email, name: "Session User", password }).expect(201);
    userId = signup.body.user.id;
    cookie = signup.headers["set-cookie"][0].split(";", 1)[0];
    await request(httpServer).get("/api/auth/me").set("Cookie", cookie).expect(200);

    const token = cookie.split("=", 2)[1]!;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await database.prisma.session.update({
      where: { tokenHash },
      data: { updatedAt: new Date(Date.now() - 25 * 60 * 60_000), expiresAt: new Date(Date.now() + 60_000) },
    });
    const refreshed = await request(httpServer).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(refreshed.headers["set-cookie"]?.[0]).toContain("relay_session=");
    const session = await database.prisma.session.findUniqueOrThrow({ where: { tokenHash } });
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60_000);
  });

  it("rejects socket reconnects after logout and session expiry", async () => {
    const connected = connect(cookie);
    connected.connect();
    await new Promise<void>((resolve, reject) => {
      connected.once("connect", () => resolve());
      connected.once("connect_error", reject);
    });
    connected.close();

    await request(httpServer).post("/api/auth/signout").set("Cookie", cookie).expect(204);
    await request(httpServer).get("/api/auth/me").set("Cookie", cookie).expect(401);
    const revoked = connect(cookie);
    revoked.connect();
    await expect(new Promise<string>((resolve) => revoked.once("connect_error", (error) => resolve(error.message)))).resolves.toBe("UNAUTHORIZED");
    revoked.close();

    const expiredToken = randomUUID();
    await database.prisma.session.create({ data: { userId, tokenHash: createHash("sha256").update(expiredToken).digest("hex"), expiresAt: new Date(Date.now() - 1_000) } });
    const expired = connect(`relay_session=${expiredToken}`);
    expired.connect();
    await expect(new Promise<string>((resolve) => expired.once("connect_error", (error) => resolve(error.message)))).resolves.toBe("UNAUTHORIZED");
    expired.close();
  });
});
