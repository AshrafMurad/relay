import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

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

export async function createPendingAttachment(
  prisma: PrismaClient,
  input: { uploadDir: string; workspaceId: string; userId: string; file: Express.Multer.File },
) {
  if (input.file.size > MAX_FILE_BYTES) throw new ApiError(400, "ATTACHMENT_TOO_LARGE", "File exceeds the 25 MiB limit.");
  const extension = extensionFor(input.file.originalname, input.file.mimetype);
  const workspace = await prisma.workspace.findFirst({
    where: { id: input.workspaceId, members: { some: { userId: input.userId, status: "ACTIVE" } } },
    select: { id: true },
  });
  if (!workspace) throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
  const used = await prisma.attachment.aggregate({
    where: { workspaceId: input.workspaceId, status: "ATTACHED" },
    _sum: { sizeBytes: true },
  });
  if ((used._sum.sizeBytes ?? 0n) + BigInt(input.file.size) > WORKSPACE_STORAGE_QUOTA_BYTES) {
    throw new ApiError(400, "WORKSPACE_STORAGE_QUOTA_EXCEEDED", "Workspace storage quota is exhausted.");
  }
  const storageKey = `${input.workspaceId}/${randomUUID()}${extension}`;
  const absoluteTarget = path.resolve(input.uploadDir, storageKey);
  const absoluteRoot = path.resolve(input.uploadDir);
  if (!absoluteTarget.startsWith(absoluteRoot + path.sep)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid storage path.");
  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  await writeFile(absoluteTarget, input.file.buffer, { flag: "wx" });
  const attachment = await prisma.attachment.create({
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
  return toDTO(attachment);
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
