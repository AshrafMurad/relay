import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { createWorkspace } from "../../src/modules/workspaces/workspace.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const available = { probe: async () => true };
const uploadDir = await mkdtemp(path.join(os.tmpdir(), "relay-identity-images-"));
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
  UPLOAD_DIR: uploadDir,
  LOG_LEVEL: "fatal",
  TRUST_PROXY: false,
};

const userIds = [randomUUID(), randomUUID(), randomUUID()];
const tokens = [randomUUID(), randomUUID(), randomUUID()];
let workspaceId = "";
let outsideWorkspaceId = "";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZL2KwAAAABJRU5ErkJggg==", "base64");

function cookie(index: number) {
  return `relay_session=${tokens[index]}`;
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({ id, email: `identity-${id}@relay.test`, name: `Identity User ${index + 1}`, emailVerified: true })),
  });
  await database.prisma.session.createMany({
    data: tokens.map((token, index) => ({ userId: userIds[index]!, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) })),
  });
  const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `Identity ${randomUUID()}` });
  workspaceId = workspace.id;
  await database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "MEMBER" } });
  const outside = await createWorkspace(database.prisma, userIds[2]!, { name: `Outside Identity ${randomUUID()}` });
  outsideWorkspaceId = outside.id;
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: { in: [workspaceId, outsideWorkspaceId] } } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
  await rm(uploadDir, { recursive: true, force: true });
});

const app = createApp(environment, { database, redis: available }, createLogger(environment));

describe("identity image uploads", () => {
  it("updates the current user's profile image and serves it to workspace members", async () => {
    const uploaded = await request(app).post("/api/auth/me/image").set("Cookie", cookie(0)).attach("file", png, { filename: "avatar.png", contentType: "image/png" }).expect(200);

    expect(uploaded.body.user.image).toMatch(/^\/api\/identity-images\/users\//);
    await request(app).get(uploaded.body.user.image).set("Cookie", cookie(1)).expect(200).expect("content-type", /image\/png/);
    await request(app).get(uploaded.body.user.image).set("Cookie", cookie(2)).expect(404);
  });

  it("lets owners update workspace images and rejects members", async () => {
    const uploaded = await request(app).post(`/api/workspaces/${workspaceId}/image`).set("Cookie", cookie(0)).attach("file", png, { filename: "workspace.png", contentType: "image/png" }).expect(200);

    expect(uploaded.body.workspace.imageUrl).toMatch(/^\/api\/identity-images\/workspaces\//);
    await request(app).get(uploaded.body.workspace.imageUrl).set("Cookie", cookie(1)).expect(200).expect("content-type", /image\/png/);
    await request(app).post(`/api/workspaces/${workspaceId}/image`).set("Cookie", cookie(1)).attach("file", png, { filename: "workspace.png", contentType: "image/png" }).expect(403);
  });

  it("rejects non-image profile uploads", async () => {
    await request(app).post("/api/auth/me/image").set("Cookie", cookie(0)).attach("file", Buffer.from("not an image"), { filename: "avatar.txt", contentType: "text/plain" }).expect(400);
  });
});
