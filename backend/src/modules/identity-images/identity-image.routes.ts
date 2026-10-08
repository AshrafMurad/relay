import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { getAuthorizedIdentityImage } from "./identity-image.service.js";

const paramsSchema = z.object({
  ownerType: z.enum(["users", "workspaces"]),
  ownerId: z.string().uuid(),
  filename: z.string().min(1).max(80),
});

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Request data is invalid.");
  return parsed.data;
}

export function createIdentityImageRouter(prisma: PrismaClient, uploadDir: string) {
  const router = Router();
  router.use(requireAuth);

  router.get("/:ownerType/:ownerId/:filename", asyncHandler(async (request, response) => {
    const params = parse(paramsSchema, request.params);
    const image = await getAuthorizedIdentityImage(prisma, { ...params, uploadDir, userId: request.authUser!.id });
    response.sendFile(image.filePath, { headers: { "content-type": image.mimeType, "cache-control": "private, max-age=3600" } });
  }));

  return router;
}
