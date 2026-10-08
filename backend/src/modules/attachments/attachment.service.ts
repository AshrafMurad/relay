import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";
import { MAX_FILE_BYTES, WORKSPACE_STORAGE_QUOTA_BYTES, type PendingAttachmentDTO } from "./attachment.contracts.js";

const allowedTypes = new Map<string, Set<string>>([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/gif", new Set([".gif"])],
  ["image/webp", new Set([".webp"])],
  ["application/pdf", new Set([".pdf"])],
  ["text/plain", new Set([".txt"])],
  ["text/csv", new Set([".csv"])],
  ["application/json", new Set([".json"])],
  ["application/zip", new Set([".zip"])],
]);

function toDTO(attachment: { id: string; workspaceId: string; originalFilename: string; mimeType: string; sizeBytes: bigint; createdAt: Date; expiresAt: Date | null }): PendingAttachmentDTO {
  return {
    id: attachment.id,
    workspaceId: attachment.workspaceId,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    sizeBytes: Number(attachment.sizeBytes),
    createdAt: attachment.createdAt.toISOString(),
    expiresAt: attachment.expiresAt!.toISOString(),
  };
}

function extensionFor(filename: string, mimeType: string) {
  const extension = path.extname(filename).toLowerCase();
  if (!allowedTypes.get(mimeType)?.has(extension)) {
    throw new ApiError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", "File type is not allowed.");
  }
  return extension;
}

function startsWith(buffer: Buffer, signature: number[]) {
  return signature.every((byte, index) => buffer[index] === byte);
}

export function validateAttachmentContent(buffer: Buffer, mimeType: string) {
  const binaryValid = mimeType === "image/jpeg" ? startsWith(buffer, [0xff, 0xd8, 0xff])
    : mimeType === "image/png" ? startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      : mimeType === "image/gif" ? buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a"
        : mimeType === "image/webp" ? buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP"
          : mimeType === "application/pdf" ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
            : mimeType === "application/zip" ? startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) || startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
              : null;
  if (binaryValid === false) throw new ApiError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", "File contents do not match the declared type.");
  if (binaryValid !== null) return;

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new ApiError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", "Text attachments must contain valid UTF-8.");
  }
  if (text.includes("\0")) throw new ApiError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", "Text attachments cannot contain null bytes.");
  if (mimeType === "application/json") {
    try {
      JSON.parse(text);
    } catch {
      throw new ApiError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", "JSON attachments must contain valid JSON.");
    }
  }
}

export async function createPendingAttachment(
  prisma: PrismaClient,
  input: { uploadDir: string; workspaceId: string; userId: string; file: Express.Multer.File },
) {
  if (input.file.size > MAX_FILE_BYTES) throw new ApiError(400, "ATTACHMENT_TOO_LARGE", "File exceeds the 25 MiB limit.");
  const extension = extensionFor(input.file.originalname, input.file.mimetype);
  validateAttachmentContent(input.file.buffer, input.file.mimetype);
  const storageKey = `${input.workspaceId}/${randomUUID()}${extension}`;
  const absoluteTarget = path.resolve(input.uploadDir, storageKey);
  const absoluteRoot = path.resolve(input.uploadDir);
  if (!absoluteTarget.startsWith(absoluteRoot + path.sep)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid storage path.");
  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  const temporaryTarget = `${absoluteTarget}.${randomUUID()}.uploading`;
  const attachment = await prisma.$transaction(async (transaction) => {
    const workspace = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT w."id"
      FROM "Workspace" w
      JOIN "WorkspaceMember" wm ON wm."workspaceId" = w."id" AND wm."userId" = ${input.userId}::uuid AND wm."status" = 'ACTIVE'
      WHERE w."id" = ${input.workspaceId}::uuid
      FOR UPDATE OF w
    `);
    if (!workspace[0]) throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
    const used = await transaction.attachment.aggregate({ where: { workspaceId: input.workspaceId }, _sum: { sizeBytes: true } });
    if ((used._sum.sizeBytes ?? 0n) + BigInt(input.file.size) > WORKSPACE_STORAGE_QUOTA_BYTES) {
      throw new ApiError(400, "WORKSPACE_STORAGE_QUOTA_EXCEEDED", "Workspace storage quota is exhausted.");
    }
    return transaction.attachment.create({
      data: {
        workspaceId: input.workspaceId,
        uploaderId: input.userId,
        originalFilename: path.basename(input.file.originalname),
        mimeType: input.file.mimetype,
        sizeBytes: BigInt(input.file.size),
        storageKey,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });
  try {
    await writeFile(temporaryTarget, input.file.buffer, { flag: "wx" });
    await rename(temporaryTarget, absoluteTarget);
  } catch (error) {
    await unlink(temporaryTarget).catch(() => undefined);
    await prisma.attachment.deleteMany({ where: { id: attachment.id, status: "PENDING" } });
    throw error;
  }
  return toDTO(attachment);
}

export async function cleanupExpiredPendingAttachments(prisma: PrismaClient, uploadDir: string, now = new Date()) {
  const expired = await prisma.attachment.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    select: { id: true, storageKey: true },
    take: 200,
  });
  let removed = 0;
  for (const attachment of expired) {
    const filePath = path.resolve(uploadDir, attachment.storageKey);
    const root = path.resolve(uploadDir);
    if (!filePath.startsWith(root + path.sep)) continue;
    const deleted = await prisma.attachment.deleteMany({ where: { id: attachment.id, status: "PENDING", expiresAt: { lte: now } } });
    if (deleted.count === 0) continue;
    removed += deleted.count;
    try {
      await unlink(filePath);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) continue;
    }
  }
  return removed;
}

export async function getAuthorizedAttachmentDownload(prisma: PrismaClient, attachmentId: string, userId: string, uploadDir: string) {
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      status: "ATTACHED",
      message: {
        workspace: { members: { some: { userId, status: "ACTIVE" } } },
        OR: [
          { channelId: { not: null } },
          { directConversation: { members: { some: { userId } } } },
        ],
      },
    },
    select: { originalFilename: true, mimeType: true, storageKey: true },
  });
  if (!attachment) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Attachment was not found.");
  const filePath = path.resolve(uploadDir, attachment.storageKey);
  const root = path.resolve(uploadDir);
  if (!filePath.startsWith(root + path.sep)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid storage path.");
  return { ...attachment, filePath };
}
