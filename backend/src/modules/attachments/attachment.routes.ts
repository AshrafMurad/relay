import { mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { createUserRateLimit } from "../../middleware/rate-limit.js";
import { attachmentParamsSchema, attachmentUploadBodySchema, MAX_FILE_BYTES } from "./attachment.contracts.js";
import { createPendingAttachment, getAuthorizedAttachmentDownload, TEMP_UPLOAD_SUFFIX } from "./attachment.service.js";

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request data is invalid.");
  return parsed.data;
}

export function createAttachmentRouter(prisma: PrismaClient, uploadDir: string) {
  const router = Router();
  // Stream uploads to a bounded temporary file instead of buffering in memory.
  // The directory shares the upload volume with final storage so completion is
  // a single atomic rename.
  const tempDir = path.join(uploadDir, "tmp");
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        void mkdir(tempDir, { recursive: true })
          .then(() => callback(null, tempDir))
          .catch((error: Error) => callback(error, ""));
      },
      filename: (_request, _file, callback) => callback(null, `${randomUUID()}${TEMP_UPLOAD_SUFFIX}`),
    }),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  });
  router.use(requireAuth);

  router.post("/", createUserRateLimit(10, 60_000, "RATE_LIMITED", "attachment-upload"), upload.single("file"), asyncHandler(async (request, response) => {
    const body = parse(attachmentUploadBodySchema, request.body);
    if (!request.file) throw new ApiError(400, "VALIDATION_ERROR", "A file is required.");
    const attachment = await createPendingAttachment(prisma, { uploadDir, workspaceId: body.workspaceId, userId: request.authUser!.id, file: request.file });
    response.status(201).json({ attachment });
  }));

  router.get("/:attachmentId/download", asyncHandler(async (request, response) => {
    const { attachmentId } = parse(attachmentParamsSchema, request.params);
    const attachment = await getAuthorizedAttachmentDownload(prisma, attachmentId, request.authUser!.id, uploadDir);
    response.setHeader("Cache-Control", "no-store");
    response.download(attachment.filePath, attachment.originalFilename, { headers: { "content-type": attachment.mimeType } });
  }));

  return router;
}
