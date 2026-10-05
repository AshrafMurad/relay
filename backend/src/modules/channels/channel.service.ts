import { Prisma, type Channel, type PrismaClient, type WorkspaceRole } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";
import { requireWorkspaceMember } from "../workspaces/workspace.service.js";
import type { ChannelDTO, CreateChannelInput, UpdateChannelInput } from "./channel.contracts.js";

export function canManageChannels(role: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}

function assertCanManageChannels(role: WorkspaceRole) {
  if (!canManageChannels(role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to manage channels.");
  }
}

function toChannelDTO(channel: Channel, activity?: { lastMessageAt: Date | null; unreadCount: number; lastReadMessageId: string | null }): ChannelDTO {
  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    name: channel.name,
    description: channel.description,
    createdById: channel.createdById,
    archivedAt: channel.archivedAt?.toISOString() ?? null,
    lastMessageAt: activity?.lastMessageAt?.toISOString() ?? null,
    unreadCount: activity?.unreadCount ?? 0,
    lastReadMessageId: activity?.lastReadMessageId ?? null,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

function normalizeDescription(description: string | null | undefined) {
  if (description === undefined) return undefined;
  return description?.trim() || null;
}

function mapChannelWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ApiError(409, "CHANNEL_NAME_TAKEN", "A channel with that name already exists in this workspace.");
  }
  throw error;
}

async function findAccessibleChannel(prisma: PrismaClient, channelId: string, userId: string) {
  const channel = await prisma.channel.findFirst({
    where: {
      id: channelId,
      workspace: { members: { some: { userId, status: "ACTIVE" } } },
    },
  });
  if (!channel) throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel was not found.");
  return channel;
}

export async function listChannels(prisma: PrismaClient, workspaceId: string, userId: string) {
  await requireWorkspaceMember(prisma, workspaceId, userId);
  const channels = await prisma.channel.findMany({
    where: { workspaceId },
  });
  const dtos = await Promise.all(channels.map(async (channel) => {
    const [latest, readState] = await Promise.all([
      prisma.message.findFirst({ where: { channelId: channel.id, deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true } }),
      prisma.channelReadState.findUnique({ where: { channelId_userId: { channelId: channel.id, userId } }, select: { lastReadMessageId: true, lastReadMessage: { select: { createdAt: true, id: true } } } }),
    ]);
    const unreadWhere = readState?.lastReadMessage === undefined || readState.lastReadMessage === null
      ? { channelId: channel.id, deletedAt: null, authorId: { not: userId } }
      : {
        channelId: channel.id,
        deletedAt: null,
        authorId: { not: userId },
        OR: [
          { createdAt: { gt: readState.lastReadMessage.createdAt } },
          { createdAt: readState.lastReadMessage.createdAt, id: { gt: readState.lastReadMessage.id } },
        ],
      };
    const unreadCount = await prisma.message.count({ where: unreadWhere });
    return toChannelDTO(channel, { lastMessageAt: latest?.createdAt ?? null, unreadCount, lastReadMessageId: readState?.lastReadMessageId ?? null });
  }));
  return dtos.sort((left, right) => {
    if (left.archivedAt && !right.archivedAt) return 1;
    if (!left.archivedAt && right.archivedAt) return -1;
    const leftActivity = left.lastMessageAt ?? left.updatedAt;
    const rightActivity = right.lastMessageAt ?? right.updatedAt;
    return rightActivity.localeCompare(leftActivity) || left.name.localeCompare(right.name);
  });
}

export async function createChannel(
  prisma: PrismaClient,
  workspaceId: string,
  actorId: string,
  input: CreateChannelInput,
) {
  const actor = await requireWorkspaceMember(prisma, workspaceId, actorId);
  assertCanManageChannels(actor.role);
  try {
    const channel = await prisma.channel.create({
      data: {
        workspaceId,
        createdById: actorId,
        name: input.name,
        description: normalizeDescription(input.description),
      },
    });
    return toChannelDTO(channel);
  } catch (error) {
    return mapChannelWriteError(error);
  }
}

export async function updateChannel(
  prisma: PrismaClient,
  channelId: string,
  actorId: string,
  input: UpdateChannelInput,
) {
  const channel = await findAccessibleChannel(prisma, channelId, actorId);
  const actor = await requireWorkspaceMember(prisma, channel.workspaceId, actorId);
  assertCanManageChannels(actor.role);
  if (channel.name === "general" && input.name !== undefined && input.name !== "general") {
    throw new ApiError(409, "DEFAULT_CHANNEL_PROTECTED", "The default general channel cannot be renamed.");
  }
  try {
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: {
        name: input.name,
        description: normalizeDescription(input.description),
      },
    });
    return toChannelDTO(updated);
  } catch (error) {
    return mapChannelWriteError(error);
  }
}

export async function archiveChannel(prisma: PrismaClient, channelId: string, actorId: string) {
  const channel = await findAccessibleChannel(prisma, channelId, actorId);
  const actor = await requireWorkspaceMember(prisma, channel.workspaceId, actorId);
  assertCanManageChannels(actor.role);
  if (channel.name === "general") {
    throw new ApiError(409, "DEFAULT_CHANNEL_PROTECTED", "The default general channel cannot be archived.");
  }
  if (channel.archivedAt) return toChannelDTO(channel);
  return toChannelDTO(await prisma.channel.update({ where: { id: channel.id }, data: { archivedAt: new Date() } }));
}

export async function restoreChannel(prisma: PrismaClient, channelId: string, actorId: string) {
  const channel = await findAccessibleChannel(prisma, channelId, actorId);
  const actor = await requireWorkspaceMember(prisma, channel.workspaceId, actorId);
  assertCanManageChannels(actor.role);
  if (!channel.archivedAt) return toChannelDTO(channel);
  return toChannelDTO(await prisma.channel.update({ where: { id: channel.id }, data: { archivedAt: null } }));
}
