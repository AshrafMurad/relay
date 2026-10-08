import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { createUserRateLimit } from "../../middleware/rate-limit.js";
import type { RealtimeEventBus } from "../../realtime/realtime-events.js";
import {
  channelMessageParamsSchema,
  conversationReadSchema,
  createMessageSchema,
  directMessageParamsSchema,
  editMessageSchema,
  messageHistoryQuerySchema,
  messageParamsSchema,
  reactionToggleSchema,
  type MessageHistoryQuery,
} from "./message.contracts.js";
import { createChannelMessage, createDirectMessage, deleteMessage, editMessage, listChannelMessages, listDirectMessages, markChannelRead, markDirectConversationRead, toggleMessageReaction } from "./message.service.js";

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

export function createChannelMessageRouter(prisma: PrismaClient, realtime?: RealtimeEventBus) {
  const router = Router();
  router.use(requireAuth);

  router.get("/:channelId/messages", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelMessageParamsSchema, request.params);
    const query = parseHistoryQuery(request.query);
    const history = await listChannelMessages(prisma, channelId, request.authUser!.id, query);
    response.json(history);
  }));

  router.post("/:channelId/messages", createUserRateLimit(30, 10_000, "MESSAGE_SEND_RATE_LIMITED"), createUserRateLimit(300, 5 * 60_000, "MESSAGE_SEND_RATE_LIMITED"), asyncHandler(async (request, response) => {
    const { channelId } = parse(channelMessageParamsSchema, request.params);
    const input = parse(createMessageSchema, request.body);
    const result = await createChannelMessage(prisma, channelId, request.authUser!.id, input);
    if (result.created && result.sequence) {
      realtime?.publish({ type: "message:new", sequence: result.sequence, conversation: { type: "channel", id: channelId, workspaceId: result.message.workspaceId, room: `channel:${channelId}` }, message: result.message });
    }
    response.status(result.created ? 201 : 200).json({ message: result.message });
  }));

  router.post("/:channelId/read", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelMessageParamsSchema, request.params);
    const input = parse(conversationReadSchema, request.body);
    const result = await markChannelRead(prisma, channelId, request.authUser!.id, input);
    if (result.sequence) realtime?.publish({ type: "conversation:read:update", sequence: result.sequence, conversation: { type: "channel", id: channelId, workspaceId: result.readState.workspaceId, room: `channel:${channelId}` }, readState: result.readState });
    response.json({ readState: result.readState });
  }));

  return router;
}

export function createMessageRouter(prisma: PrismaClient, realtime?: RealtimeEventBus) {
  const router = Router();
  router.use(requireAuth);

  router.patch("/:messageId", asyncHandler(async (request, response) => {
    const { messageId } = parse(messageParamsSchema, request.params);
    const input = parse(editMessageSchema, request.body);
    const result = await editMessage(prisma, messageId, request.authUser!.id, input);
    realtime?.publish({ type: "message:update", sequence: result.sequence, conversation: result.conversation, message: result.message });
    response.json({ message: result.message });
  }));

  router.delete("/:messageId", asyncHandler(async (request, response) => {
    const { messageId } = parse(messageParamsSchema, request.params);
    const result = await deleteMessage(prisma, messageId, request.authUser!.id);
    if (result.sequence) realtime?.publish({ type: "message:delete", sequence: result.sequence, conversation: result.conversation, message: result.message });
    response.json({ message: result.message });
  }));

  router.post("/:messageId/reactions", createUserRateLimit(60, 60_000, "RATE_LIMITED", "reaction-change"), asyncHandler(async (request, response) => {
    const { messageId } = parse(messageParamsSchema, request.params);
    const input = parse(reactionToggleSchema, request.body);
    const result = await toggleMessageReaction(prisma, messageId, request.authUser!.id, input);
    realtime?.publish({ type: "reaction:update", sequence: result.sequence, conversation: result.conversation, messageId: result.messageId });
    response.json({ messageId: result.messageId, reactions: result.reactions });
  }));

  return router;
}

export function createDirectMessageRouter(prisma: PrismaClient, realtime?: RealtimeEventBus) {
  const router = Router();
  router.use(requireAuth);

  router.get("/:conversationId/messages", asyncHandler(async (request, response) => {
    const { conversationId } = parse(directMessageParamsSchema, request.params);
    const query = parseHistoryQuery(request.query);
    const history = await listDirectMessages(prisma, conversationId, request.authUser!.id, query);
    response.json(history);
  }));

  router.post("/:conversationId/messages", createUserRateLimit(30, 10_000, "MESSAGE_SEND_RATE_LIMITED"), createUserRateLimit(300, 5 * 60_000, "MESSAGE_SEND_RATE_LIMITED"), asyncHandler(async (request, response) => {
    const { conversationId } = parse(directMessageParamsSchema, request.params);
    const input = parse(createMessageSchema, request.body);
    const result = await createDirectMessage(prisma, conversationId, request.authUser!.id, input);
    if (result.created && result.sequence) {
      realtime?.publish({ type: "message:new", sequence: result.sequence, conversation: { type: "dm", id: conversationId, workspaceId: result.message.workspaceId, room: `dm:${conversationId}` }, message: result.message });
    }
    response.status(result.created ? 201 : 200).json({ message: result.message });
  }));

  router.post("/:conversationId/read", asyncHandler(async (request, response) => {
    const { conversationId } = parse(directMessageParamsSchema, request.params);
    const input = parse(conversationReadSchema, request.body);
    const result = await markDirectConversationRead(prisma, conversationId, request.authUser!.id, input);
    if (result.sequence) realtime?.publish({ type: "conversation:read:update", sequence: result.sequence, conversation: { type: "dm", id: conversationId, workspaceId: result.readState.workspaceId, room: `dm:${conversationId}` }, readState: result.readState });
    response.json({ readState: result.readState });
  }));

  return router;
}
