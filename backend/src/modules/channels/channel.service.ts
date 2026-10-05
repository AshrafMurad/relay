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

function toChannelDTO(channel: Channel): ChannelDTO {
  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    name: channel.name,
    description: channel.description,
    createdById: channel.createdById,
    archivedAt: channel.archivedAt?.toISOString() ?? null,
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
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
  });
  return channels.map(toChannelDTO);
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
