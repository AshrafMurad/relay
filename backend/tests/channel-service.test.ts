import type { Channel, PrismaClient, WorkspaceMember } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/lib/api-error.js";
import { archiveChannel, createChannel, listChannels, restoreChannel } from "../src/modules/channels/channel.service.js";

const now = new Date("2026-10-05T12:00:00.000Z");

function member(role: "OWNER" | "ADMIN" | "MEMBER", status: "ACTIVE" | "REMOVED" = "ACTIVE"): WorkspaceMember {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    workspaceId: "20000000-0000-4000-8000-000000000001",
    userId: "30000000-0000-4000-8000-000000000001",
    role,
    status,
    joinedAt: now,
    removedAt: status === "REMOVED" ? now : null,
    removedById: null,
  };
}

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    workspaceId: "20000000-0000-4000-8000-000000000001",
    name: "product",
    description: null,
    createdById: "30000000-0000-4000-8000-000000000001",
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function prismaMock(options: {
  actor?: WorkspaceMember | null;
  accessibleChannel?: Channel | null;
  channels?: Channel[];
}) {
  const created = channel();
  return {
    workspaceMember: {
      findUnique: vi.fn().mockResolvedValue(options.actor === undefined ? member("OWNER") : options.actor),
    },
    channel: {
      findFirst: vi.fn().mockResolvedValue(options.accessibleChannel === undefined ? created : options.accessibleChannel),
      findMany: vi.fn().mockResolvedValue(options.channels ?? [created]),
      create: vi.fn().mockResolvedValue(created),
      update: vi.fn().mockImplementation(({ data }: { data: Partial<Channel> }) => Promise.resolve({ ...created, ...data })),
    },
  } as unknown as PrismaClient;
}

describe("channel service authorization", () => {
  it("lets active members list archived and active channels", async () => {
    const archived = channel({ id: "40000000-0000-4000-8000-000000000002", name: "old", archivedAt: now });
    const prisma = prismaMock({ actor: member("MEMBER"), channels: [channel(), archived] });
    const result = await listChannels(prisma, member("MEMBER").workspaceId, member("MEMBER").userId);
    expect(result).toHaveLength(2);
    expect(result[1]?.archivedAt).toBe(now.toISOString());
  });

  it("hides workspaces from removed members", async () => {
    const prisma = prismaMock({ actor: member("MEMBER", "REMOVED") });
    await expect(listChannels(prisma, member("MEMBER").workspaceId, member("MEMBER").userId)).rejects.toMatchObject({
      statusCode: 404,
      code: "WORKSPACE_NOT_FOUND",
    } satisfies Partial<ApiError>);
  });

  it("rejects channel creation by members", async () => {
    const prisma = prismaMock({ actor: member("MEMBER") });
    await expect(createChannel(prisma, member("MEMBER").workspaceId, member("MEMBER").userId, { name: "team" })).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    } satisfies Partial<ApiError>);
  });

  it("allows admins to create channels", async () => {
    const prisma = prismaMock({ actor: member("ADMIN") });
    await expect(createChannel(prisma, member("ADMIN").workspaceId, member("ADMIN").userId, { name: "team" })).resolves.toMatchObject({ name: "product" });
  });

  it("does not expose a channel outside the actor's active workspaces", async () => {
    const prisma = prismaMock({ accessibleChannel: null });
    await expect(archiveChannel(prisma, channel().id, member("OWNER").userId)).rejects.toMatchObject({
      statusCode: 404,
      code: "CHANNEL_NOT_FOUND",
    } satisfies Partial<ApiError>);
  });

  it("protects general from archival", async () => {
    const prisma = prismaMock({ accessibleChannel: channel({ name: "general" }) });
    await expect(archiveChannel(prisma, channel().id, member("OWNER").userId)).rejects.toMatchObject({
      statusCode: 409,
      code: "DEFAULT_CHANNEL_PROTECTED",
    } satisfies Partial<ApiError>);
  });

  it("restores an archived channel", async () => {
    const prisma = prismaMock({ accessibleChannel: channel({ archivedAt: now }) });
    await expect(restoreChannel(prisma, channel().id, member("OWNER").userId)).resolves.toMatchObject({ archivedAt: null });
  });
});
