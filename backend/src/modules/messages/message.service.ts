import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { requireAccessibleDirectConversation } from "../direct-conversations/direct-conversation.service.js";
import {
  MESSAGE_MAX_CODE_POINTS,
  type ConversationReadInput,
  type ConversationReadStateDTO,
  type CreateMessageInput,
  type EditMessageInput,
  type MessageDTO,
  type MessageHistoryDTO,
  type ReactionSummaryDTO,
  type ReactionToggleInput,
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
  reactions: { select: { emoji: true, userId: true } },
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

function summarizeReactions(reactions: Array<{ emoji: string; userId: string }>, viewerId: string): ReactionSummaryDTO[] {
  const summaries = new Map<string, ReactionSummaryDTO>();
  for (const reaction of reactions) {
    const current = summaries.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, reactedByMe: false };
    current.count += 1;
    current.reactedByMe ||= reaction.userId === viewerId;
    summaries.set(reaction.emoji, current);
  }
  return [...summaries.values()].sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji));
}

function toMessageDTO(message: MessageRecord, viewerId: string): MessageDTO {
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
    reactions: summarizeReactions(message.reactions, viewerId),
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

function conversationFromMessage(message: { workspaceId: string; channelId: string | null; directConversationId: string | null }) {
  if (message.channelId) return { workspaceId: message.workspaceId, type: "channel" as const, id: message.channelId, room: `channel:${message.channelId}` };
  if (message.directConversationId) return { workspaceId: message.workspaceId, type: "dm" as const, id: message.directConversationId, room: `dm:${message.directConversationId}` };
  throw new ApiError(500, "INTERNAL_ERROR", "Message has no conversation target.");
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
    messages: page.reverse().map((message) => toMessageDTO(message, userId)),
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
    messages: page.reverse().map((message) => toMessageDTO(message, userId)),
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
        return { message: toMessageDTO(replay, authorId), created: false };
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
      return { message: toMessageDTO(message, authorId), created: true };
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
    return { message: toMessageDTO(existing, authorId), created: false };
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
        return { message: toMessageDTO(replay, authorId), created: false };
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
      return { message: toMessageDTO(message, authorId), created: true };
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
    return { message: toMessageDTO(existing, authorId), created: false };
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
    return toMessageDTO(message, authorId);
  });
}

export async function deleteMessage(prisma: PrismaClient, messageId: string, authorId: string) {
  return prisma.$transaction(async (transaction) => {
    const existing = await lockAccessibleMessage(transaction, messageId, authorId);
    if (existing.authorId !== authorId) throw new ApiError(403, "FORBIDDEN", "Only the author can delete this message.");
    if (existing.deletedAt) return toMessageDTO(existing, authorId);
    const message = await transaction.message.update({
      where: { id: existing.id },
      data: { content: "", deletedAt: new Date() },
      select: messageSelect,
    });
    return toMessageDTO(message, authorId);
  });
}

export async function toggleMessageReaction(prisma: PrismaClient, messageId: string, userId: string, input: ReactionToggleInput) {
  return prisma.$transaction(async (transaction) => {
    const existing = await lockAccessibleMessage(transaction, messageId, userId);
    const conversation = conversationFromMessage(existing);
    if (existing.channel?.archivedAt) throw new ApiError(409, "CHANNEL_ARCHIVED", "Archived channels are read-only.");
    if (existing.deletedAt) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
    const reaction = await transaction.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: existing.id, userId, emoji: input.emoji } },
      select: { id: true },
    });
    if (reaction) {
      await transaction.messageReaction.delete({ where: { id: reaction.id } });
    } else {
      await transaction.messageReaction.create({ data: { messageId: existing.id, userId, emoji: input.emoji } });
    }
    const reactions = await transaction.messageReaction.findMany({ where: { messageId: existing.id }, select: { emoji: true, userId: true } });
    return { messageId: existing.id, conversation, reactions: summarizeReactions(reactions, userId) };
  });
}

function toReadStateDTO(input: { workspaceId: string; type: "channel" | "dm"; id: string; userId: string; lastReadMessageId: string; lastReadAt: Date }): ConversationReadStateDTO {
  return {
    workspaceId: input.workspaceId,
    conversation: { type: input.type, id: input.id },
    userId: input.userId,
    lastReadMessageId: input.lastReadMessageId,
    lastReadAt: input.lastReadAt.toISOString(),
  };
}

async function shouldAdvanceReadState(transaction: Transaction, currentMessageId: string | null, next: { createdAt: Date; id: string }) {
  if (!currentMessageId) return true;
  const current = await transaction.message.findUnique({ where: { id: currentMessageId }, select: { createdAt: true, id: true } });
  if (!current) return true;
  return current.createdAt < next.createdAt || (current.createdAt.getTime() === next.createdAt.getTime() && current.id < next.id);
}

export async function markChannelRead(prisma: PrismaClient, channelId: string, userId: string, input: ConversationReadInput) {
  return prisma.$transaction(async (transaction) => {
    const channel = await lockAccessibleChannel(transaction, channelId, userId);
    const message = await transaction.message.findFirst({
      where: { id: input.messageId, channelId: channel.id, workspaceId: channel.workspaceId },
      select: { id: true, createdAt: true },
    });
    if (!message) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
    const current = await transaction.channelReadState.findUnique({ where: { channelId_userId: { channelId: channel.id, userId } } });
    if (current && !(await shouldAdvanceReadState(transaction, current.lastReadMessageId, message))) {
      return toReadStateDTO({ workspaceId: channel.workspaceId, type: "channel", id: channel.id, userId, lastReadMessageId: current.lastReadMessageId!, lastReadAt: current.lastReadAt });
    }
    const readState = await transaction.channelReadState.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      create: { channelId: channel.id, userId, lastReadMessageId: message.id },
      update: { lastReadMessageId: message.id, lastReadAt: new Date() },
    });
    return toReadStateDTO({ workspaceId: channel.workspaceId, type: "channel", id: channel.id, userId, lastReadMessageId: readState.lastReadMessageId!, lastReadAt: readState.lastReadAt });
  });
}

export async function markDirectConversationRead(prisma: PrismaClient, conversationId: string, userId: string, input: ConversationReadInput) {
  return prisma.$transaction(async (transaction) => {
    const conversation = await lockAccessibleDirectConversation(transaction, conversationId, userId);
    const message = await transaction.message.findFirst({
      where: { id: input.messageId, directConversationId: conversation.id, workspaceId: conversation.workspaceId },
      select: { id: true, createdAt: true },
    });
    if (!message) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
    const current = await transaction.directConversationReadState.findUnique({ where: { directConversationId_userId: { directConversationId: conversation.id, userId } } });
    if (current && !(await shouldAdvanceReadState(transaction, current.lastReadMessageId, message))) {
      return toReadStateDTO({ workspaceId: conversation.workspaceId, type: "dm", id: conversation.id, userId, lastReadMessageId: current.lastReadMessageId!, lastReadAt: current.lastReadAt });
    }
    const readState = await transaction.directConversationReadState.upsert({
      where: { directConversationId_userId: { directConversationId: conversation.id, userId } },
      create: { directConversationId: conversation.id, userId, lastReadMessageId: message.id },
      update: { lastReadMessageId: message.id, lastReadAt: new Date() },
    });
    return toReadStateDTO({ workspaceId: conversation.workspaceId, type: "dm", id: conversation.id, userId, lastReadMessageId: readState.lastReadMessageId!, lastReadAt: readState.lastReadAt });
  });
}
