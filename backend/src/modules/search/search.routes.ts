import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { createUserRateLimit } from "../../middleware/rate-limit.js";
import { searchMessages } from "../messages/message.service.js";

const searchQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  q: z.string().min(2).max(200),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request data is invalid.");
  return parsed.data;
}

export function createSearchRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", createUserRateLimit(30, 60_000), asyncHandler(async (request, response) => {
    const query = parse(searchQuerySchema, request.query);
    const results = await searchMessages(prisma, query.workspaceId, request.authUser!.id, query);
    response.json(results);
  }));

  return router;
}
