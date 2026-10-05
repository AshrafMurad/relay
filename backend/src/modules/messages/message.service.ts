import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { requireAccessibleDirectConversation } from "../direct-conversations/direct-conversation.service.js";
import {
  MESSAGE_MAX_CODE_POINTS,
  type CreateMessageInput,
  type EditMessageInput,
  type MessageDTO,
  type MessageHistoryDTO,
} from "./message.contracts.js";

const historyCursorSchema = z.object({
  v: z.literal(1),
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
}).strict();

const messageSelect = {
  id: true,
  workspaceId: true,
  channelId: true,
  directConversationId: true,
  operationId: true,
  content: true,
  parentMessageId: true,
  editedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, image: true } },
  parent: {
    select: {
      id: true,
      content: true,
      deletedAt: true,
      author: { select: { name: true } },
    },
  },
} satisfies Prisma.MessageSelect;

type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type Transaction = Prisma.TransactionClient;

interface LockedChannel {
  id: string;
  workspaceId: string;
  archivedAt: Date | null;
}

interface LockedDirectConversation {
  id: string;
  workspaceId: string;
}

function toMessageDTO(message: MessageRecord): MessageDTO {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    channelId: message.channelId,
    directConversationId: message.directConversationId,
    operationId: message.operationId,
    author: message.author,
    content: message.content,
    parentMessageId: message.parentMessageId,
    parent: message.parent === null ? null : {
      id: message.parent.id,
      authorName: message.parent.author.name,
      content: message.parent.content,
      deletedAt: message.parent.deletedAt?.toISOString() ?? null,
    },
    editedAt: message.editedAt?.toISOString() ?? null,
    deletedAt: message.deletedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export function normalizeMessageContent(content: string) {
  const normalized = content.trim();
  if (normalized.length === 0) {
    throw new ApiError(400, "MESSAGE_EMPTY", "Message content cannot be empty.");
  }
  if ([...normalized].length > MESSAGE_MAX_CODE_POINTS) {
    throw new ApiError(400, "MESSAGE_TOO_LONG", "Message content cannot exceed 4,000 Unicode code points.");
  }
  return normalized;
}

export function encodeMessageCursor(createdAt: Date, id: string) {
  return Buffer.from(JSON.stringify({ v: 1, createdAt: createdAt.toISOString(), id }), "utf8").toString("base64url");
}

export function decodeMessageCursor(cursor: string) {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid base64url");
    const decoded = Buffer.from(cursor, "base64url");
    if (decoded.toString("base64url") !== cursor) throw new Error("Non-canonical base64url");
    const parsed = historyCursorSchema.parse(JSON.parse(decoded.toString("utf8")));
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) throw new Error("Invalid date");
    return { createdAt, id: parsed.id };
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "Message history cursor is invalid.");
  }
}

export async function requireAccessibleChannel(prisma: PrismaClient, channelId: string, userId: string) {
  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      workspace: { members: { some: { userId, status: "ACTIVE" } } },
    },
    select: { id: true, workspaceId: true, archivedAt: true },
  });
  if (!channel) throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel was not found.");
  return channel;
}

async function lockAccessibleChannel(prisma: Transaction, channelId: string, userId: string) {
  const channels = await prisma.$queryRaw<LockedChannel[]>(Prisma.sql`
    SELECT c."id", c."workspaceId", c."archivedAt"
    FROM "Channel" c
    JOIN "WorkspaceMember" wm
      ON wm."workspaceId" = c."workspaceId"
      AND wm."userId" = ${userId}::uuid
      AND wm."status" = 'ACTIVE'
    WHERE c."id" = ${channelId}::uuid
    FOR SHARE OF c, wm
  `);
  const channel = channels[0];
  if (!channel) throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel was not found.");
  return channel;
}

async function lockAccessibleDirectConversation(prisma: Transaction, conversationId: string, userId: string) {
  const conversations = await prisma.$queryRaw<LockedDirectConversation[]>(Prisma.sql`
    SELECT dc."id", dc."workspaceId"
    FROM "DirectConversation" dc
    JOIN "DirectConversationMember" dcm
      ON dcm."conversationId" = dc."id"
      AND dcm."userId" = ${userId}::uuid
    JOIN "WorkspaceMember" wm
      ON wm."workspaceId" = dc."workspaceId"
      AND wm."userId" = ${userId}::uuid
      AND wm."status" = 'ACTIVE'
    WHERE dc."id" = ${conversationId}::uuid
    FOR SHARE OF dc, dcm, wm
  `);
  const conversation = conversations[0];
  if (!conversation) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Direct conversation was not found.");
  return conversation;
}

async function lockAccessibleMessage(prisma: Transaction, messageId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT m."id"
    FROM "Message" m
    LEFT JOIN "DirectConversation" dc ON dc."id" = m."directConversationId" AND dc."workspaceId" = m."workspaceId"
    LEFT JOIN "DirectConversationMember" dcm ON dcm."conversationId" = dc."id" AND dcm."userId" = ${userId}::uuid
    JOIN "WorkspaceMember" wm
      ON wm."workspaceId" = m."workspaceId"
      AND wm."userId" = ${userId}::uuid
      AND wm."status" = 'ACTIVE'
    WHERE m."id" = ${messageId}::uuid
      AND (m."channelId" IS NOT NULL OR dcm."id" IS NOT NULL)
    FOR UPDATE OF m, wm
  `);
  if (!rows[0]) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { ...messageSelect, authorId: true, channel: { select: { archivedAt: true } } },
  });
  if (!message) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
  return message;
}

export async function listChannelMessages(
  prisma: PrismaClient,
  channelId: string,
  userId: string,
  options: { cursor?: string; limit: number },
): Promise<MessageHistoryDTO> {
  const channel = await requireAccessibleChannel(prisma, channelId, userId);
  const cursor = options.cursor === undefined ? undefined : decodeMessageCursor(options.cursor);
  const messages = await prisma.message.findMany({
    where: {
      channelId: channel.id,
      workspaceId: channel.workspaceId,
      ...(cursor === undefined ? {} : {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    select: messageSelect,
  });
  const hasMore = messages.length > options.limit;
  const page = messages.slice(0, options.limit);
  const oldest = page.at(-1);
  return {
    messages: page.reverse().map(toMessageDTO),
    nextCursor: hasMore && oldest ? encodeMessageCursor(oldest.createdAt, oldest.id) : null,
    hasMore,
  };
}

export async function listDirectMessages(
  prisma: PrismaClient,
  conversationId: string,
  userId: string,
  options: { cursor?: string; limit: number },
): Promise<MessageHistoryDTO> {
  const conversation = await requireAccessibleDirectConversation(prisma, conversationId, userId);
  const cursor = options.cursor === undefined ? undefined : decodeMessageCursor(options.cursor);
  const messages = await prisma.message.findMany({
    where: {
      directConversationId: conversation.id,
      workspaceId: conversation.workspaceId,
      ...(cursor === undefined ? {} : {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.limit + 1,
    select: messageSelect,
  });
  const hasMore = messages.length > options.limit;
  const page = messages.slice(0, options.limit);
  const oldest = page.at(-1);
  return {
    messages: page.reverse().map(toMessageDTO),
    nextCursor: hasMore && oldest ? encodeMessageCursor(oldest.createdAt, oldest.id) : null,
    hasMore,
  };
}

export async function createChannelMessage(
  prisma: PrismaClient,
  channelId: string,
  authorId: string,
  input: CreateMessageInput,
): Promise<{ message: MessageDTO; created: boolean }> {
  const content = normalizeMessageContent(input.content);
  try {
    return await prisma.$transaction(async (transaction) => {
      const channel = await lockAccessibleChannel(transaction, channelId, authorId);
      const replay = await transaction.message.findUnique({
        where: { authorId_operationId: { authorId, operationId: input.operationId } },
        select: messageSelect,
      });
      if (replay) {
        if (replay.channelId !== channel.id || replay.workspaceId !== channel.workspaceId) {
          throw new ApiError(409, "VALIDATION_ERROR", "operationId has already been used for another message.");
        }
        return { message: toMessageDTO(replay), created: false };
      }
      if (channel.archivedAt) throw new ApiError(409, "CHANNEL_ARCHIVED", "Archived channels are read-only.");
      if (input.parentMessageId) {
        const parent = await transaction.message.findFirst({
          where: { id: input.parentMessageId, channelId: channel.id, workspaceId: channel.workspaceId },
          select: { id: true },
        });
        if (!parent) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Parent message was not found.");
      }
      const message = await transaction.message.create({
        data: {
          workspaceId: channel.workspaceId,
          channelId: channel.id,
          authorId,
          operationId: input.operationId,
          parentMessageId: input.parentMessageId ?? null,
          content,
          createdAt: new Date(),
        },
        select: messageSelect,
      });
      return { message: toMessageDTO(message), created: true };
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const channel = await requireAccessibleChannel(prisma, channelId, authorId);
    const existing = await prisma.message.findUnique({
      where: { authorId_operationId: { authorId, operationId: input.operationId } },
      select: messageSelect,
    });
    if (!existing || existing.channelId !== channel.id || existing.workspaceId !== channel.workspaceId) {
      throw new ApiError(409, "VALIDATION_ERROR", "operationId has already been used for another message.");
    }
    return { message: toMessageDTO(existing), created: false };
  }
}

export async function createDirectMessage(
  prisma: PrismaClient,
  conversationId: string,
  authorId: string,
  input: CreateMessageInput,
): Promise<{ message: MessageDTO; created: boolean }> {
  const content = normalizeMessageContent(input.content);
  try {
    return await prisma.$transaction(async (transaction) => {
      const conversation = await lockAccessibleDirectConversation(transaction, conversationId, authorId);
      const replay = await transaction.message.findUnique({
        where: { authorId_operationId: { authorId, operationId: input.operationId } },
        select: messageSelect,
      });
      if (replay) {
        if (replay.directConversationId !== conversation.id || replay.workspaceId !== conversation.workspaceId) {
          throw new ApiError(409, "VALIDATION_ERROR", "operationId has already been used for another message.");
        }
        return { message: toMessageDTO(replay), created: false };
      }
      if (input.parentMessageId) {
        const parent = await transaction.message.findFirst({
          where: { id: input.parentMessageId, directConversationId: conversation.id, workspaceId: conversation.workspaceId },
          select: { id: true },
        });
        if (!parent) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Parent message was not found.");
      }
      const message = await transaction.message.create({
        data: {
          workspaceId: conversation.workspaceId,
          directConversationId: conversation.id,
          authorId,
          operationId: input.operationId,
          parentMessageId: input.parentMessageId ?? null,
          content,
          createdAt: new Date(),
        },
        select: messageSelect,
      });
      return { message: toMessageDTO(message), created: true };
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const conversation = await requireAccessibleDirectConversation(prisma, conversationId, authorId);
    const existing = await prisma.message.findUnique({
      where: { authorId_operationId: { authorId, operationId: input.operationId } },
      select: messageSelect,
    });
    if (!existing || existing.directConversationId !== conversation.id || existing.workspaceId !== conversation.workspaceId) {
      throw new ApiError(409, "VALIDATION_ERROR", "operationId has already been used for another message.");
    }
    return { message: toMessageDTO(existing), created: false };
  }
}

export async function editMessage(prisma: PrismaClient, messageId: string, authorId: string, input: EditMessageInput) {
  const content = normalizeMessageContent(input.content);
  return prisma.$transaction(async (transaction) => {
    const existing = await lockAccessibleMessage(transaction, messageId, authorId);
    if (existing.authorId !== authorId) throw new ApiError(403, "FORBIDDEN", "Only the author can edit this message.");
    if (existing.channel?.archivedAt) throw new ApiError(409, "CHANNEL_ARCHIVED", "Archived channels are read-only.");
    if (existing.deletedAt) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
    const message = await transaction.message.update({
      where: { id: existing.id },
      data: { content, editedAt: new Date() },
      select: messageSelect,
    });
    return toMessageDTO(message);
  });
}

export async function deleteMessage(prisma: PrismaClient, messageId: string, authorId: string) {
  return prisma.$transaction(async (transaction) => {
    const existing = await lockAccessibleMessage(transaction, messageId, authorId);
    if (existing.authorId !== authorId) throw new ApiError(403, "FORBIDDEN", "Only the author can delete this message.");
    if (existing.deletedAt) return toMessageDTO(existing);
    const message = await transaction.message.update({
      where: { id: existing.id },
      data: { content: "", deletedAt: new Date() },
      select: messageSelect,
    });
    return toMessageDTO(message);
  });
}
