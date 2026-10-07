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
const sessionTokens = [randomUUID(), randomUUID(), randomUUID()];
const emails = userIds.map((id) => `invite-${id}@relay.test`);
let workspaceId = "";

function cookie(index: number) {
  return `relay_session=${sessionTokens[index]}`;
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({ id, email: emails[index]!, name: `Invite User ${index + 1}`, emailVerified: true })),
  });
  await database.prisma.session.createMany({
    data: sessionTokens.map((token, index) => ({
      userId: userIds[index]!,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    })),
  });
  const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `Invitation ${randomUUID()}` });
  workspaceId = workspace.id;
  await database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "ADMIN" } });
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

const app = createApp(environment, { database, redis: available }, createLogger(environment));

describe("workspace invitations", () => {
  it("creates, previews, and accepts an invitation", async () => {
    const created = await request(app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set("Cookie", cookie(1))
      .send({ email: emails[2], role: "MEMBER" })
      .expect(201);

    const token = created.body.token as string;
    const preview = await request(app).get(`/api/workspaces/invitations/${token}`).expect(200);
    expect(preview.body.invitation).toMatchObject({ status: "PENDING", role: "MEMBER" });
    expect(preview.body.invitation.emailHint).not.toBe(emails[2]);

    const accepted = await request(app)
      .post("/api/workspaces/invitations/accept")
      .set("Cookie", cookie(2))
      .send({ token })
      .expect(200);
    expect(accepted.body.workspace).toMatchObject({ id: workspaceId, currentUserRole: "MEMBER" });

    await request(app)
      .post("/api/workspaces/invitations/accept")
      .set("Cookie", cookie(2))
      .send({ token })
      .expect(409)
      .expect(({ body }) => expect(body).toMatchObject({ error: { code: "INVITATION_ALREADY_USED" } }));
  });

  it("rejects invitations for existing active members", async () => {
    await request(app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set("Cookie", cookie(1))
      .send({ email: emails[0], role: "MEMBER" })
      .expect(409)
      .expect(({ body }) => expect(body).toMatchObject({ error: { code: "ALREADY_MEMBER" } }));
  });

  it("preserves an active owner's role when consuming a legacy invitation", async () => {
    const token = randomUUID();
    await database.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: emails[0]!,
        role: "MEMBER",
        tokenHash: createHash("sha256").update(token).digest("hex"),
        invitedById: userIds[1]!,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const response = await request(app)
      .post("/api/workspaces/invitations/accept")
      .set("Cookie", cookie(0))
      .send({ token })
      .expect(200);
    expect(response.body.workspace.currentUserRole).toBe("OWNER");

    const membership = await database.prisma.workspaceMember.findUniqueOrThrow({
      where: { workspaceId_userId: { workspaceId, userId: userIds[0]! } },
    });
    expect(membership.role).toBe("OWNER");
  });

  it("allows an admin to revoke a pending member invitation", async () => {
    const created = await request(app)
      .post(`/api/workspaces/${workspaceId}/invitations`)
      .set("Cookie", cookie(1))
      .send({ email: `pending-${randomUUID()}@relay.test`, role: "MEMBER" })
      .expect(201);

    const revoked = await request(app)
      .delete(`/api/workspaces/${workspaceId}/invitations/${created.body.invitation.id as string}`)
      .set("Cookie", cookie(1))
      .expect(200);
    expect(revoked.body.invitation.revokedAt).toEqual(expect.any(String));
  });
});
