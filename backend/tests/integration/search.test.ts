import { createHash, randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { findOrCreateDirectConversation } from "../../src/modules/direct-conversations/direct-conversation.service.js";
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
const userIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const tokens = userIds.map(() => randomUUID());
const workspaceIds: string[] = [];
let primaryWorkspaceId = "";
let secondaryWorkspaceId = "";

function cookie(index: number) {
  return `relay_session=${tokens[index]}`;
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({ data: userIds.map((id, index) => ({ id, email: `search-${id}@relay.test`, name: `Search User ${index + 1}`, emailVerified: true })) });
  await database.prisma.session.createMany({
    data: tokens.map((token, index) => ({ userId: userIds[index]!, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 300_000) })),
  });
  primaryWorkspaceId = (await createWorkspace(database.prisma, userIds[0]!, { name: `Search Primary ${randomUUID()}` })).id;
  secondaryWorkspaceId = (await createWorkspace(database.prisma, userIds[3]!, { name: `Search Secondary ${randomUUID()}` })).id;
  workspaceIds.push(primaryWorkspaceId, secondaryWorkspaceId);
  await database.prisma.workspaceMember.createMany({ data: [
    { workspaceId: primaryWorkspaceId, userId: userIds[1]!, role: "MEMBER" },
    { workspaceId: primaryWorkspaceId, userId: userIds[2]!, role: "MEMBER" },
  ] });
  const primaryChannel = await database.prisma.channel.findFirstOrThrow({ where: { workspaceId: primaryWorkspaceId, name: "general" } });
  const secondaryChannel = await database.prisma.channel.findFirstOrThrow({ where: { workspaceId: secondaryWorkspaceId, name: "general" } });
  const direct = await findOrCreateDirectConversation(database.prisma, primaryWorkspaceId, userIds[0]!, userIds[1]!);
  await database.prisma.message.createMany({ data: [
    { workspaceId: primaryWorkspaceId, channelId: primaryChannel.id, authorId: userIds[0]!, operationId: randomUUID(), content: "Orbital channel update", createdAt: new Date("2026-01-03T00:00:00.000Z") },
    { workspaceId: primaryWorkspaceId, directConversationId: direct.id, authorId: userIds[1]!, operationId: randomUUID(), content: "Orbital private update", createdAt: new Date("2026-01-02T00:00:00.000Z") },
    { workspaceId: primaryWorkspaceId, channelId: primaryChannel.id, authorId: userIds[0]!, operationId: randomUUID(), content: "", deletedAt: new Date(), createdAt: new Date("2026-01-01T00:00:00.000Z") },
    { workspaceId: secondaryWorkspaceId, channelId: secondaryChannel.id, authorId: userIds[3]!, operationId: randomUUID(), content: "Orbital foreign update" },
  ] });
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

const app = createApp(environment, { database, redis: available }, createLogger(environment));

describe("message search authorization", () => {
  it("returns public channels and only DMs the viewer participates in", async () => {
    const participant = await request(app).get("/api/search").set("Cookie", cookie(0)).query({ workspaceId: primaryWorkspaceId, q: "orbital" }).expect(200);
    expect(participant.body.results.map((message: { content: string }) => message.content)).toEqual(["Orbital channel update", "Orbital private update"]);

    const nonParticipant = await request(app).get("/api/search").set("Cookie", cookie(2)).query({ workspaceId: primaryWorkspaceId, q: "orbital" }).expect(200);
    expect(nonParticipant.body.results.map((message: { content: string }) => message.content)).toEqual(["Orbital channel update"]);
  });

  it("isolates workspaces and paginates without leaking deleted messages", async () => {
    await request(app).get("/api/search").set("Cookie", cookie(3)).query({ workspaceId: primaryWorkspaceId, q: "orbital" }).expect(404);
    const foreign = await request(app).get("/api/search").set("Cookie", cookie(3)).query({ workspaceId: secondaryWorkspaceId, q: "orbital" }).expect(200);
    expect(foreign.body.results.map((message: { content: string }) => message.content)).toEqual(["Orbital foreign update"]);

    const first = await request(app).get("/api/search").set("Cookie", cookie(0)).query({ workspaceId: primaryWorkspaceId, q: "orbital", limit: 1 }).expect(200);
    expect(first.body).toMatchObject({ hasMore: true, results: [{ content: "Orbital channel update" }] });
    const second = await request(app).get("/api/search").set("Cookie", cookie(0)).query({ workspaceId: primaryWorkspaceId, q: "orbital", limit: 1, cursor: first.body.nextCursor }).expect(200);
    expect(second.body).toMatchObject({ hasMore: false, results: [{ content: "Orbital private update" }] });
  });
});
