import { Prisma, type PrismaClient } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";
import { requireWorkspaceMember } from "../workspaces/workspace.service.js";
import type { DirectConversationDTO } from "./direct-conversation.contracts.js";

const directConversationSelect = {
  id: true,
  workspaceId: true,
  participantKey: true,
  createdAt: true,
  updatedAt: true,
  members: {
    select: { userId: true, user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { userId: "asc" },
  },
  messages: { select: { createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
  readStates: { select: { userId: true, lastReadMessageId: true, lastReadMessage: { select: { createdAt: true, id: true } } } },
} satisfies Prisma.DirectConversationSelect;

type DirectConversationRecord = Prisma.DirectConversationGetPayload<{ select: typeof directConversationSelect }>;

export function participantKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join(":");
}

async function countUnreadDirectMessages(prisma: PrismaClient, conversation: DirectConversationRecord, viewerId: string) {
  const readState = conversation.readStates.find((state) => state.userId === viewerId);
  const unreadWhere = readState?.lastReadMessage === undefined || readState.lastReadMessage === null
    ? { directConversationId: conversation.id, deletedAt: null, authorId: { not: viewerId } }
    : {
      directConversationId: conversation.id,
      deletedAt: null,
      authorId: { not: viewerId },
      OR: [
        { createdAt: { gt: readState.lastReadMessage.createdAt } },
        { createdAt: readState.lastReadMessage.createdAt, id: { gt: readState.lastReadMessage.id } },
      ],
    };
  return prisma.message.count({ where: unreadWhere });
}

async function toDirectConversationDTO(prisma: PrismaClient, conversation: DirectConversationRecord, viewerId: string): Promise<DirectConversationDTO> {
  const other = conversation.members.find((member) => member.userId !== viewerId)?.user;
  if (!other) throw new ApiError(500, "INTERNAL_ERROR", "Direct conversation is missing its other participant.");
  const readState = conversation.readStates.find((state) => state.userId === viewerId);
  return {
    id: conversation.id,
    workspaceId: conversation.workspaceId,
    participantKey: conversation.participantKey,
    otherUser: other,
    lastMessageAt: conversation.messages[0]?.createdAt.toISOString() ?? null,
    unreadCount: await countUnreadDirectMessages(prisma, conversation, viewerId),
    lastReadMessageId: readState?.lastReadMessageId ?? null,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export async function requireAccessibleDirectConversation(prisma: PrismaClient, conversationId: string, userId: string) {
  const conversation = await prisma.directConversation.findFirst({
    where: {
      id: conversationId,
      members: { some: { userId } },
      workspace: { members: { some: { userId, status: "ACTIVE" } } },
    },
    select: { id: true, workspaceId: true },
  });
  if (!conversation) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Direct conversation was not found.");
  return conversation;
}

export async function listDirectConversations(prisma: PrismaClient, workspaceId: string, userId: string) {
  await requireWorkspaceMember(prisma, workspaceId, userId);
  const conversations = await prisma.directConversation.findMany({
    where: { workspaceId, members: { some: { userId } } },
    select: directConversationSelect,
  });
  return (await Promise.all(conversations.map((conversation) => toDirectConversationDTO(prisma, conversation, userId))))
    .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt));
}

export async function findOrCreateDirectConversation(prisma: PrismaClient, workspaceId: string, actorId: string, otherUserId: string) {
  if (actorId === otherUserId) throw new ApiError(400, "VALIDATION_ERROR", "Choose another workspace member to message.");
  await requireWorkspaceMember(prisma, workspaceId, actorId);
  await requireWorkspaceMember(prisma, workspaceId, otherUserId);
  const key = participantKey(actorId, otherUserId);
  try {
    const conversation = await prisma.directConversation.upsert({
      where: { workspaceId_participantKey: { workspaceId, participantKey: key } },
      create: {
        workspaceId,
        participantKey: key,
        members: { create: [{ userId: actorId }, { userId: otherUserId }] },
      },
      update: {},
      select: directConversationSelect,
    });
    return toDirectConversationDTO(prisma, conversation, actorId);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const conversation = await prisma.directConversation.findUniqueOrThrow({
      where: { workspaceId_participantKey: { workspaceId, participantKey: key } },
      select: directConversationSelect,
    });
    return toDirectConversationDTO(prisma, conversation, actorId);
  }
}
