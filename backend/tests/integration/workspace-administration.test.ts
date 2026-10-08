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

const userIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const sessionTokens = userIds.map(() => randomUUID());
let workspaceId = "";
let ownerMemberId = "";
let adminMemberId = "";
let memberId = "";
let removableMemberId = "";

function cookie(index: number) {
  return `relay_session=${sessionTokens[index]}`;
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({ id, email: `workspace-admin-${id}@relay.test`, name: `Workspace User ${index + 1}`, emailVerified: true })),
  });
  await database.prisma.session.createMany({
    data: sessionTokens.map((token, index) => ({ userId: userIds[index]!, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60_000) })),
  });
  workspaceId = (await createWorkspace(database.prisma, userIds[0]!, { name: `Administration ${randomUUID()}` })).id;
  const memberships = await Promise.all([
    database.prisma.workspaceMember.findUniqueOrThrow({ where: { workspaceId_userId: { workspaceId, userId: userIds[0]! } } }),
    database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "ADMIN" } }),
    database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[2]!, role: "MEMBER" } }),
    database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[3]!, role: "MEMBER" } }),
  ]);
  [ownerMemberId, adminMemberId, memberId, removableMemberId] = memberships.map((membership) => membership.id);
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

const app = createApp(environment, { database, redis: available }, createLogger(environment));

describe("workspace administration", () => {
  it("restricts workspace settings and role changes to the owner", async () => {
    await request(app).patch(`/api/workspaces/${workspaceId}`).set("Cookie", cookie(1)).send({ name: "Blocked rename" }).expect(403);
    await request(app).patch(`/api/workspaces/${workspaceId}`).set("Cookie", cookie(0)).send({ name: "Relay Operations" }).expect(200)
      .expect(({ body }) => expect(body.workspace).toMatchObject({ name: "Relay Operations", currentUserRole: "OWNER" }));

    await request(app).patch(`/api/workspaces/${workspaceId}/members/${memberId}`).set("Cookie", cookie(1)).send({ role: "ADMIN" }).expect(403);
    await request(app).patch(`/api/workspaces/${workspaceId}/members/${memberId}`).set("Cookie", cookie(0)).send({ role: "ADMIN" }).expect(200)
      .expect(({ body }) => expect(body.member).toMatchObject({ id: memberId, role: "ADMIN" }));
    await request(app).patch(`/api/workspaces/${workspaceId}/members/${ownerMemberId}`).set("Cookie", cookie(0)).send({ role: "MEMBER" }).expect(403);
  });

  it("lets admins remove members but not admins or owners", async () => {
    await request(app).delete(`/api/workspaces/${workspaceId}/members/${ownerMemberId}`).set("Cookie", cookie(1)).expect(403);
    await request(app).delete(`/api/workspaces/${workspaceId}/members/${memberId}`).set("Cookie", cookie(1)).expect(403);
    await request(app).delete(`/api/workspaces/${workspaceId}/members/${adminMemberId}`).set("Cookie", cookie(1)).expect(403);
    await request(app).delete(`/api/workspaces/${workspaceId}/members/${removableMemberId}`).set("Cookie", cookie(1)).expect(204);

    const removed = await database.prisma.workspaceMember.findUniqueOrThrow({ where: { id: removableMemberId } });
    expect(removed).toMatchObject({ status: "REMOVED", removedById: userIds[1] });
    expect(removed.removedAt).toBeInstanceOf(Date);
    await request(app).get(`/api/workspaces/${workspaceId}`).set("Cookie", cookie(3)).expect(404);
  });
});
