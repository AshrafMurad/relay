import { access, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { WORKSPACE_STORAGE_QUOTA_BYTES } from "../../src/modules/attachments/attachment.contracts.js";
import { cleanupExpiredPendingAttachments } from "../../src/modules/attachments/attachment.service.js";
import { createWorkspace } from "../../src/modules/workspaces/workspace.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const userIds = [randomUUID(), randomUUID(), randomUUID()];
const sessionTokens = userIds.map(() => randomUUID());
const userId = userIds[0]!;
const sessionToken = sessionTokens[0]!;
let workspaceId = "";
let uploadDir = "";
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  uploadDir = await mkdtemp(path.join(tmpdir(), "relay-attachments-"));
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
  await database.connect();
  await database.prisma.user.createMany({ data: userIds.map((id, index) => ({ id, email: `attachment-${id}@relay.test`, name: `Attachment User ${index + 1}`, emailVerified: true })) });
  await database.prisma.session.createMany({ data: sessionTokens.map((token, index) => ({ userId: userIds[index]!, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 300_000) })) });
  workspaceId = (await createWorkspace(database.prisma, userId, { name: `Attachments ${randomUUID()}` })).id;
  await database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "MEMBER" } });
  app = createApp(environment, { database, redis: { probe: async () => true } }, createLogger(environment));
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
  await rm(uploadDir, { recursive: true, force: true });
});

function upload(buffer: Buffer, filename: string, contentType: string) {
  return request(app).post("/api/attachments").set("Cookie", `relay_session=${sessionToken}`).field("workspaceId", workspaceId).attach("file", buffer, { filename, contentType });
}

async function tempFiles() {
  try {
    return await readdir(path.join(uploadDir, "tmp"));
  } catch {
    return [];
  }
}

describe("attachment uploads", () => {
  it("validates content and cleans up expired pending files", async () => {
    await upload(Buffer.from("not a png"), "spoofed.png", "image/png").expect(400)
      .expect(({ body }) => expect(body).toMatchObject({ error: { code: "ATTACHMENT_TYPE_NOT_ALLOWED" } }));
    await expect(tempFiles()).resolves.toEqual([]);

    const created = await upload(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "valid.png", "image/png").expect(201);
    const attachment = await database.prisma.attachment.findUniqueOrThrow({ where: { id: created.body.attachment.id } });
    await expect(access(path.join(uploadDir, attachment.storageKey))).resolves.toBeUndefined();
    await expect(tempFiles()).resolves.toEqual([]);
    await database.prisma.attachment.update({ where: { id: attachment.id }, data: { expiresAt: new Date(Date.now() - 1_000) } });

    await expect(cleanupExpiredPendingAttachments(database.prisma, uploadDir)).resolves.toBe(1);
    await expect(database.prisma.attachment.findUnique({ where: { id: attachment.id } })).resolves.toBeNull();
    await expect(access(path.join(uploadDir, attachment.storageKey))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("counts pending reservations against the workspace quota", async () => {
    const reservation = await database.prisma.attachment.create({
      data: {
        workspaceId,
        uploaderId: userId,
        originalFilename: "reserved.zip",
        mimeType: "application/zip",
        sizeBytes: WORKSPACE_STORAGE_QUOTA_BYTES - 1n,
        storageKey: `${workspaceId}/${randomUUID()}.zip`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    try {
      await upload(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "over-quota.png", "image/png").expect(400)
        .expect(({ body }) => expect(body).toMatchObject({ error: { code: "WORKSPACE_STORAGE_QUOTA_EXCEEDED" } }));
      await expect(tempFiles()).resolves.toEqual([]);
    } finally {
      await database.prisma.attachment.deleteMany({ where: { id: reservation.id } });
    }
  });

  it("serves attached files only to active authorized conversation members", async () => {
    const created = await upload(Buffer.from("authorized attachment"), "authorization.txt", "text/plain").expect(201);
    const attachmentId = created.body.attachment.id as string;
    await request(app).get(`/api/attachments/${attachmentId}/download`).set("Cookie", `relay_session=${sessionToken}`).expect(404);

    const channel = await database.prisma.channel.findFirstOrThrow({ where: { workspaceId, name: "general" } });
    await request(app).post(`/api/channels/${channel.id}/messages`).set("Cookie", `relay_session=${sessionToken}`).send({ operationId: randomUUID(), content: "", attachmentIds: [attachmentId] }).expect(201);
    await request(app).get(`/api/attachments/${attachmentId}/download`).set("Cookie", `relay_session=${sessionTokens[1]}`).expect(200)
      .expect("content-type", /text\/plain/)
      .expect("content-disposition", /authorization\.txt/)
      .expect("cache-control", "no-store");
    await request(app).get(`/api/attachments/${attachmentId}/download`).set("Cookie", `relay_session=${sessionTokens[2]}`).expect(404);

    await request(app).post(`/api/channels/${channel.id}/messages`).set("Cookie", `relay_session=${sessionToken}`).send({ operationId: randomUUID(), content: "reuse", attachmentIds: [attachmentId] }).expect(400)
      .expect(({ body }) => expect(body).toMatchObject({ error: { code: "ATTACHMENT_NOT_FOUND" } }));

    await database.prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: userIds[1]! } }, data: { status: "REMOVED", removedAt: new Date(), removedById: userId } });
    try {
      await request(app).get(`/api/attachments/${attachmentId}/download`).set("Cookie", `relay_session=${sessionTokens[1]}`).expect(404);
    } finally {
      await database.prisma.workspaceMember.update({ where: { workspaceId_userId: { workspaceId, userId: userIds[1]! } }, data: { status: "ACTIVE", removedAt: null, removedById: null } });
    }
  });
});
