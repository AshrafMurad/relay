import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { createDirectConversationSchema } from "./direct-conversation.contracts.js";
import { findOrCreateDirectConversation, listDirectConversations } from "./direct-conversation.service.js";

const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request data is invalid.");
  return parsed.data;
}

export function createDirectConversationRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth);

  router.get("/workspaces/:workspaceId/direct-conversations", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(workspaceParamsSchema, request.params);
    const conversations = await listDirectConversations(prisma, workspaceId, request.authUser!.id);
    response.json({ conversations });
  }));

  router.post("/workspaces/:workspaceId/direct-conversations", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(workspaceParamsSchema, request.params);
    const input = parse(createDirectConversationSchema, request.body);
    const conversation = await findOrCreateDirectConversation(prisma, workspaceId, request.authUser!.id, input.userId);
    response.status(201).json({ conversation });
  }));

  return router;
}
