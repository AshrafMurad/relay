import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabase } from "../../src/lib/database.js";
import { archiveChannel, createChannel, listChannels, restoreChannel } from "../../src/modules/channels/channel.service.js";
import { createWorkspace } from "../../src/modules/workspaces/workspace.service.js";

const database = createDatabase(process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay");
const userIds = [randomUUID(), randomUUID(), randomUUID()];
const workspaceIds: string[] = [];

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({
      id,
      email: `sprint2-${id}@relay.test`,
      name: `Sprint 2 User ${index + 1}`,
      emailVerified: true,
    })),
  });
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

describe("channel persistence and isolation", () => {
  it("creates general atomically with a new workspace", async () => {
    const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `Sprint 2 ${randomUUID()}` });
    workspaceIds.push(workspace.id);
    const channels = await listChannels(database.prisma, workspace.id, userIds[0]!);
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({ name: "general", archivedAt: null, workspaceId: workspace.id });
  });

  it("enforces roles, archived-name uniqueness, restore, and workspace isolation", async () => {
    const first = await createWorkspace(database.prisma, userIds[0]!, { name: `First ${randomUUID()}` });
    const second = await createWorkspace(database.prisma, userIds[1]!, { name: `Second ${randomUUID()}` });
    workspaceIds.push(first.id, second.id);

    await database.prisma.workspaceMember.create({ data: { workspaceId: first.id, userId: userIds[2]!, role: "MEMBER" } });
    await expect(createChannel(database.prisma, first.id, userIds[2]!, { name: "member-channel" })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const channel = await createChannel(database.prisma, first.id, userIds[0]!, { name: "release_notes", description: " Releases " });
    expect(channel.description).toBe("Releases");
    const archived = await archiveChannel(database.prisma, channel.id, userIds[0]!);
    expect(archived.archivedAt).not.toBeNull();

    await expect(createChannel(database.prisma, first.id, userIds[0]!, { name: "release_notes" })).rejects.toMatchObject({ code: "CHANNEL_NAME_TAKEN" });
    await expect(archiveChannel(database.prisma, channel.id, userIds[1]!)).rejects.toMatchObject({ code: "CHANNEL_NOT_FOUND" });

    const restored = await restoreChannel(database.prisma, channel.id, userIds[0]!);
    expect(restored.archivedAt).toBeNull();

    const general = (await listChannels(database.prisma, first.id, userIds[0]!)).find((item) => item.name === "general")!;
    await expect(archiveChannel(database.prisma, general.id, userIds[0]!)).rejects.toMatchObject({ code: "DEFAULT_CHANNEL_PROTECTED" });
  });

  it("enforces channel-name grammar in PostgreSQL", async () => {
    const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `Constraint ${randomUUID()}` });
    workspaceIds.push(workspace.id);
    await expect(database.prisma.channel.create({
      data: { workspaceId: workspace.id, createdById: userIds[0]!, name: "Invalid Name" },
    })).rejects.toThrow();
  });
});
