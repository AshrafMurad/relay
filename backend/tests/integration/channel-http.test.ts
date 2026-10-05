import { createHash, randomUUID } from "node:crypto";

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

const userIds = [randomUUID(), randomUUID(), randomUUID()];
const tokens = [randomUUID(), randomUUID(), randomUUID()];
const workspaceIds: string[] = [];
let workspaceId = "";
let createdChannelId = "";

function cookie(index: number) {
  return `relay_session=${tokens[index]}`;
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({ id, email: `http-${id}@relay.test`, name: `HTTP User ${index + 1}`, emailVerified: true })),
  });
  await database.prisma.session.createMany({
    data: tokens.map((token, index) => ({
      userId: userIds[index]!,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    })),
  });
  const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `HTTP ${randomUUID()}` });
  workspaceId = workspace.id;
  workspaceIds.push(workspace.id);
  await database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "MEMBER" } });
  const outsiderWorkspace = await createWorkspace(database.prisma, userIds[2]!, { name: `Outside ${randomUUID()}` });
  workspaceIds.push(outsiderWorkspace.id);
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

const app = createApp(environment, { database, redis: available }, createLogger(environment));

describe("channel HTTP authorization", () => {
  it("requires authentication", async () => {
    const response = await request(app).get(`/api/workspaces/${workspaceId}/channels`).expect(401);
    expect(response.body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("allows an owner to list and create a channel", async () => {
    const listResponse = await request(app).get(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(0)).expect(200);
    expect(listResponse.body.channels).toEqual([expect.objectContaining({ name: "general" })]);

    const createResponse = await request(app)
      .post(`/api/workspaces/${workspaceId}/channels`)
      .set("Cookie", cookie(0))
      .send({ name: "http-channel", description: "Created over HTTP" })
      .expect(201);
    createdChannelId = createResponse.body.channel.id as string;
  });

  it("returns stable validation and conflict errors", async () => {
    const invalid = await request(app).post(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(0)).send({ name: "Invalid Name" }).expect(400);
    expect(invalid.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });

    const duplicate = await request(app).post(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(0)).send({ name: "http-channel" }).expect(409);
    expect(duplicate.body).toMatchObject({ error: { code: "CHANNEL_NAME_TAKEN" } });
  });

  it("rejects member management and hides cross-workspace resources", async () => {
    const forbidden = await request(app).post(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(1)).send({ name: "member-channel" }).expect(403);
    expect(forbidden.body).toMatchObject({ error: { code: "FORBIDDEN" } });

    const hiddenWorkspace = await request(app).get(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(2)).expect(404);
    expect(hiddenWorkspace.body).toMatchObject({ error: { code: "WORKSPACE_NOT_FOUND" } });

    const hiddenChannel = await request(app).post(`/api/channels/${createdChannelId}/archive`).set("Cookie", cookie(2)).expect(404);
    expect(hiddenChannel.body).toMatchObject({ error: { code: "CHANNEL_NOT_FOUND" } });
  });
});
