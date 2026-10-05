import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  channelMessageParamsSchema,
  createMessageSchema,
  editMessageSchema,
  messageHistoryQuerySchema,
  messageParamsSchema,
  type MessageHistoryQuery,
} from "./message.contracts.js";
import { createChannelMessage, deleteMessage, editMessage, listChannelMessages } from "./message.service.js";

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request data is invalid.");
  }
  return parsed.data;
}

function parseHistoryQuery(value: unknown): MessageHistoryQuery {
  const parsed = messageHistoryQuerySchema.safeParse(value);
  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "cursor")) {
      throw new ApiError(400, "INVALID_CURSOR", "Message history cursor is invalid.");
    }
    throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request data is invalid.");
  }
  return parsed.data;
}

export function createChannelMessageRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth);

  router.get("/:channelId/messages", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelMessageParamsSchema, request.params);
    const query = parseHistoryQuery(request.query);
    const history = await listChannelMessages(prisma, channelId, request.authUser!.id, query);
    response.json(history);
  }));

  router.post("/:channelId/messages", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelMessageParamsSchema, request.params);
    const input = parse(createMessageSchema, request.body);
    const result = await createChannelMessage(prisma, channelId, request.authUser!.id, input);
    response.status(result.created ? 201 : 200).json({ message: result.message });
  }));

  return router;
}

export function createMessageRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth);

  router.patch("/:messageId", asyncHandler(async (request, response) => {
    const { messageId } = parse(messageParamsSchema, request.params);
    const input = parse(editMessageSchema, request.body);
    const message = await editMessage(prisma, messageId, request.authUser!.id, input);
    response.json({ message });
  }));

  router.delete("/:messageId", asyncHandler(async (request, response) => {
    const { messageId } = parse(messageParamsSchema, request.params);
    const message = await deleteMessage(prisma, messageId, request.authUser!.id);
    response.json({ message });
  }));

  return router;
}
