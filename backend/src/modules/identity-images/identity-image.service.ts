import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";

export const MAX_IDENTITY_IMAGE_BYTES = 5 * 1024 * 1024;

const allowedImageTypes = new Map<string, Set<string>>([
  ["image/jpeg", new Set([".jpg", ".jpeg"])],
  ["image/png", new Set([".png"])],
  ["image/gif", new Set([".gif"])],
  ["image/webp", new Set([".webp"])],
]);

const mimeByExtension = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

function extensionFor(file: Express.Multer.File) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedImageTypes.get(file.mimetype)?.has(extension)) {
    throw new ApiError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", "Profile and workspace images must be JPG, PNG, GIF, or WebP files.");
  }
  return extension;
}

async function storeIdentityImage(input: { uploadDir: string; ownerType: "users" | "workspaces"; ownerId: string; file: Express.Multer.File }) {
  if (input.file.size > MAX_IDENTITY_IMAGE_BYTES) throw new ApiError(400, "ATTACHMENT_TOO_LARGE", "Image exceeds the 5 MiB limit.");
  const extension = extensionFor(input.file);
  const filename = `${randomUUID()}${extension}`;
  const storageKey = path.join("identity", input.ownerType, input.ownerId, filename);
  const absoluteTarget = path.resolve(input.uploadDir, storageKey);
  const absoluteRoot = path.resolve(input.uploadDir);
  if (!absoluteTarget.startsWith(absoluteRoot + path.sep)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid storage path.");
  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  await writeFile(absoluteTarget, input.file.buffer, { flag: "wx" });
  return `/api/identity-images/${input.ownerType}/${input.ownerId}/${filename}`;
}

export async function updateUserImage(prisma: PrismaClient, input: { uploadDir: string; userId: string; file: Express.Multer.File }) {
  const image = await storeIdentityImage({ uploadDir: input.uploadDir, ownerType: "users", ownerId: input.userId, file: input.file });
  return prisma.user.update({ where: { id: input.userId }, data: { image } });
}

export async function updateWorkspaceImage(prisma: PrismaClient, input: { uploadDir: string; workspaceId: string; userId: string; file: Express.Multer.File }) {
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } } });
  if (!membership || membership.status !== "ACTIVE") throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
  if (membership.role !== "OWNER" && membership.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "You do not have permission to update this workspace image.");
  const imageUrl = await storeIdentityImage({ uploadDir: input.uploadDir, ownerType: "workspaces", ownerId: input.workspaceId, file: input.file });
  const workspace = await prisma.workspace.update({ where: { id: input.workspaceId }, data: { imageUrl } });
  return { workspace, role: membership.role };
}

export async function getAuthorizedIdentityImage(prisma: PrismaClient, input: { uploadDir: string; ownerType: "users" | "workspaces"; ownerId: string; filename: string; userId: string }) {
  const extension = path.extname(input.filename).toLowerCase();
  const mimeType = mimeByExtension.get(extension);
  if (!mimeType || !/^[0-9a-f-]+\.(?:jpg|jpeg|png|gif|webp)$/i.test(input.filename)) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Image was not found.");
  const imagePath = `/api/identity-images/${input.ownerType}/${input.ownerId}/${input.filename}`;

  if (input.ownerType === "workspaces") {
    const workspace = await prisma.workspace.findFirst({
      where: { id: input.ownerId, imageUrl: imagePath, members: { some: { userId: input.userId, status: "ACTIVE" } } },
      select: { id: true },
    });
    if (!workspace) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Image was not found.");
  } else {
    const user = await prisma.user.findFirst({
      where: {
        id: input.ownerId,
        image: imagePath,
        OR: [
          { id: input.userId },
          { memberships: { some: { status: "ACTIVE", workspace: { members: { some: { userId: input.userId, status: "ACTIVE" } } } } } },
        ],
      },
      select: { id: true },
    });
    if (!user) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "Image was not found.");
  }

  const filePath = path.resolve(input.uploadDir, "identity", input.ownerType, input.ownerId, input.filename);
  const root = path.resolve(input.uploadDir);
  if (!filePath.startsWith(root + path.sep)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid storage path.");
  return { filePath, mimeType };
}
