import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { messageSelect, toMessageDTO } from "../messages/message.service.js";

const syncCursorSchema = z.object({ v: z.literal(1), sequence: z.string().regex(/^\d+$/) }).strict();

function encodeSyncCursor(sequence: bigint) {
  return Buffer.from(JSON.stringify({ v: 1, sequence: sequence.toString() }), "utf8").toString("base64url");
}

function decodeSyncCursor(cursor: string) {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid base64url");
    const decoded = Buffer.from(cursor, "base64url");
    if (decoded.toString("base64url") !== cursor) throw new Error("Non-canonical base64url");
    const parsed = syncCursorSchema.parse(JSON.parse(decoded.toString("utf8")));
    return BigInt(parsed.sequence);
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "Sync cursor is invalid.");
  }
}

export async function getWorkspaceSync(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
  input: { after?: string; limit: number },
) {
  const membership = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId, status: "ACTIVE" }, select: { id: true } });
  if (!membership) throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");

  if (!input.after) {
    const highWater = await prisma.workspaceSyncEvent.aggregate({ where: { workspaceId }, _max: { sequence: true } });
    return { events: [], nextCursor: encodeSyncCursor(highWater._max.sequence ?? 0n), hasMore: false, resetRequired: false };
  }

  const after = decodeSyncCursor(input.after);
  const rows = await prisma.workspaceSyncEvent.findMany({
    where: { workspaceId, sequence: { gt: after } },
    orderBy: { sequence: "asc" },
    take: input.limit,
  });
  const highestScanned = rows.at(-1)?.sequence ?? after;
  const visible = [];

  for (const event of rows) {
    if (event.directConversationId) {
      const member = await prisma.directConversationMember.findUnique({ where: { conversationId_userId: { conversationId: event.directConversationId, userId } }, select: { id: true } });
      if (!member) continue;
    }
    if (event.messageId && event.eventType.startsWith("message:")) {
      const message = await prisma.message.findUnique({ where: { id: event.messageId }, select: messageSelect });
      if (!message) continue;
      visible.push({
        sequence: event.sequence.toString(),
        type: event.eventType === "message:create" ? "message:new" : event.eventType,
        occurredAt: event.createdAt.toISOString(),
        data: { message: toMessageDTO(message, userId) },
      });
      continue;
    }
    if (event.messageId && event.eventType === "reaction:update") {
      const message = await prisma.message.findUnique({ where: { id: event.messageId }, select: messageSelect });
      if (!message) continue;
      const hydrated = toMessageDTO(message, userId);
      visible.push({
        sequence: event.sequence.toString(),
        type: event.eventType,
        occurredAt: event.createdAt.toISOString(),
        data: { messageId: message.id, reactions: hydrated.reactions },
      });
      continue;
    }
    if (event.eventType === "conversation:read:update" && event.userId && event.messageId) {
      const message = await prisma.message.findUnique({ where: { id: event.messageId }, select: { id: true, channelId: true, directConversationId: true } });
      if (!message) continue;
      const readState = message.channelId
        ? await prisma.channelReadState.findUnique({ where: { channelId_userId: { channelId: message.channelId, userId: event.userId } } })
        : await prisma.directConversationReadState.findUnique({ where: { directConversationId_userId: { directConversationId: message.directConversationId!, userId: event.userId } } });
      if (!readState?.lastReadMessageId) continue;
      visible.push({
        sequence: event.sequence.toString(),
        type: event.eventType,
        occurredAt: event.createdAt.toISOString(),
        data: {
          readState: {
            workspaceId,
            conversation: message.channelId ? { type: "channel" as const, id: message.channelId } : { type: "dm" as const, id: message.directConversationId! },
            userId: event.userId,
            lastReadMessageId: readState.lastReadMessageId,
            lastReadAt: readState.lastReadAt.toISOString(),
          },
        },
      });
    }
  }

  const more = await prisma.workspaceSyncEvent.findFirst({ where: { workspaceId, sequence: { gt: highestScanned } }, select: { id: true } });
  return { events: visible, nextCursor: encodeSyncCursor(highestScanned), hasMore: Boolean(more), resetRequired: false };
}

export const syncQuerySchema = z.object({
  after: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});
