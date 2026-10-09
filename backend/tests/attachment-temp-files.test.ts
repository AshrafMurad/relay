import { access, mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPendingAttachment,
  sweepStaleTempUploads,
  TEMP_UPLOAD_MAX_AGE_MS,
  TEMP_UPLOAD_SUFFIX,
} from "../src/modules/attachments/attachment.service.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let uploadDir = "";

beforeEach(async () => {
  uploadDir = await mkdtemp(path.join(tmpdir(), "relay-temp-uploads-"));
});

afterEach(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});

async function writeTempFile(name: string, contents: Buffer) {
  await mkdir(path.join(uploadDir, "tmp"), { recursive: true });
  const filePath = path.join(uploadDir, "tmp", name);
  await writeFile(filePath, contents);
  return filePath;
}

async function expectGone(filePath: string) {
  await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("sweepStaleTempUploads", () => {
  it("removes only stale temporary files", async () => {
    const now = new Date("2026-10-09T12:00:00.000Z").getTime();
    const staleAt = new Date(now - TEMP_UPLOAD_MAX_AGE_MS - 60_000);
    const freshAt = new Date(now - 60_000);

    const stale = await writeTempFile(`stale${TEMP_UPLOAD_SUFFIX}`, PNG_SIGNATURE);
    const fresh = await writeTempFile(`fresh${TEMP_UPLOAD_SUFFIX}`, PNG_SIGNATURE);
    const unrelated = await writeTempFile("notes.txt", Buffer.from("keep me"));
    await utimes(stale, staleAt, staleAt);
    await utimes(fresh, freshAt, freshAt);
    await utimes(unrelated, staleAt, staleAt);
    await mkdir(path.join(uploadDir, "tmp", `directory${TEMP_UPLOAD_SUFFIX}`));

    const removed = await sweepStaleTempUploads(uploadDir, TEMP_UPLOAD_MAX_AGE_MS, now);

    expect(removed).toBe(1);
    await expectGone(stale);
    await expect(access(fresh)).resolves.toBeUndefined();
    await expect(access(unrelated)).resolves.toBeUndefined();
    await expect(access(path.join(uploadDir, "tmp", `directory${TEMP_UPLOAD_SUFFIX}`))).resolves.toBeUndefined();
  });

  it("returns zero when no temporary directory exists", async () => {
    await expect(sweepStaleTempUploads(uploadDir, TEMP_UPLOAD_MAX_AGE_MS, Date.now())).resolves.toBe(0);
  });
});

type TransactionBehavior =
  | { kind: "not-a-member" }
  | { kind: "quota-exceeded" }
  | { kind: "persistence-succeeds" };

function createPrismaStub(behavior: TransactionBehavior) {
  const transaction = vi.fn(async (run: (client: unknown) => Promise<unknown>) => run({
    $queryRaw: async () => behavior.kind === "not-a-member" ? [] : [{ id: "workspace" }],
    attachment: {
      aggregate: async () => behavior.kind === "quota-exceeded"
        ? { _sum: { sizeBytes: 5n * 1024n * 1024n * 1024n } }
        : { _sum: { sizeBytes: 0n } },
      create: async () => ({
        id: "attachment-1",
        workspaceId: "workspace",
        originalFilename: "payload.png",
        mimeType: "image/png",
        sizeBytes: BigInt(PNG_SIGNATURE.length),
        storageKey: "workspace/file.png",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
  }));
  const deleteMany = vi.fn(async () => ({ count: 1 }));
  return {
    prisma: {
      $transaction: transaction,
      attachment: { deleteMany },
    } as unknown as PrismaClient,
    deleteMany,
    transaction,
  };
}

function multerFile(tempPath: string, contents: Buffer, mimetype = "image/png", originalname = "payload.png") {
  return {
    path: tempPath,
    size: contents.length,
    mimetype,
    originalname,
  } as unknown as Express.Multer.File;
}

const WORKSPACE_ID = randomUUID();
const USER_ID = randomUUID();

function uploadInput() {
  return { workspaceId: WORKSPACE_ID, userId: USER_ID, uploadDir };
}

describe("temporary upload cleanup", () => {
  it("deletes the streamed file when content validation fails without opening a transaction", async () => {
    const { prisma, transaction } = createPrismaStub({ kind: "persistence-succeeds" });
    const tempPath = await writeTempFile(`${randomUUID()}${TEMP_UPLOAD_SUFFIX}`, Buffer.from("<script>alert(1)</script>"));

    await expect(createPendingAttachment(prisma, {
      ...uploadInput(),
      file: multerFile(tempPath, Buffer.from("<script>alert(1)</script>")),
    })).rejects.toMatchObject({ code: "ATTACHMENT_TYPE_NOT_ALLOWED" });
    await expectGone(tempPath);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("deletes the streamed file when workspace authorization fails", async () => {
    const { prisma } = createPrismaStub({ kind: "not-a-member" });
    const tempPath = await writeTempFile(`${randomUUID()}${TEMP_UPLOAD_SUFFIX}`, PNG_SIGNATURE);

    await expect(createPendingAttachment(prisma, { ...uploadInput(), file: multerFile(tempPath, PNG_SIGNATURE) }))
      .rejects.toMatchObject({ code: "WORKSPACE_NOT_FOUND" });
    await expectGone(tempPath);
    expect((await readdir(path.join(uploadDir, "tmp"))).length).toBe(0);
  });

  it("deletes the streamed file when the workspace quota is exhausted", async () => {
    const { prisma } = createPrismaStub({ kind: "quota-exceeded" });
    const tempPath = await writeTempFile(`${randomUUID()}${TEMP_UPLOAD_SUFFIX}`, PNG_SIGNATURE);

    await expect(createPendingAttachment(prisma, { ...uploadInput(), file: multerFile(tempPath, PNG_SIGNATURE) }))
      .rejects.toMatchObject({ code: "WORKSPACE_STORAGE_QUOTA_EXCEEDED" });
    await expectGone(tempPath);
  });

  it("rolls back the attachment row and deletes the streamed file when final persistence fails", async () => {
    const { prisma, deleteMany } = createPrismaStub({ kind: "persistence-succeeds" });
    const tempPath = await writeTempFile(`${randomUUID()}${TEMP_UPLOAD_SUFFIX}`, PNG_SIGNATURE);
    // A file occupies the workspace directory path, so the rename target
    // directory cannot be created and the atomic rename must fail.
    await writeFile(path.join(uploadDir, WORKSPACE_ID), Buffer.from("not a directory"));

    await expect(createPendingAttachment(prisma, { ...uploadInput(), file: multerFile(tempPath, PNG_SIGNATURE) }))
      .rejects.toMatchObject({ code: expect.stringMatching(/^(EEXIST|ENOTDIR|EPERM)$/) });
    expect(deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "attachment-1", status: "PENDING" }),
    }));
    await expectGone(tempPath);
    expect((await readdir(uploadDir)).length).toBe(2); // the blocking file plus the tmp directory
  });

  it("deletes the streamed file when the extension is not allowed for the declared type", async () => {
    const { prisma, transaction } = createPrismaStub({ kind: "persistence-succeeds" });
    const tempPath = await writeTempFile(`${randomUUID()}${TEMP_UPLOAD_SUFFIX}`, PNG_SIGNATURE);

    await expect(createPendingAttachment(prisma, {
      ...uploadInput(),
      file: multerFile(tempPath, PNG_SIGNATURE, "image/png", "payload.txt"),
    })).rejects.toMatchObject({ code: "ATTACHMENT_TYPE_NOT_ALLOWED" });
    await expectGone(tempPath);
    expect(transaction).not.toHaveBeenCalled();
  });
});
