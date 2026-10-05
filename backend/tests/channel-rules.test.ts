import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { channelNameSchema, updateChannelSchema } from "../src/modules/channels/channel.contracts.js";
import { canManageChannels } from "../src/modules/channels/channel.service.js";

describe("channel permissions", () => {
  it("allows owners and admins to manage channels", () => {
    expect(canManageChannels(WorkspaceRole.OWNER)).toBe(true);
    expect(canManageChannels(WorkspaceRole.ADMIN)).toBe(true);
    expect(canManageChannels(WorkspaceRole.MEMBER)).toBe(false);
  });
});

describe("channel validation", () => {
  it.each(["general", "a2", "release-notes", "team_updates", "x".repeat(80)])("accepts %s", (name) => {
    expect(channelNameSchema.safeParse(name).success).toBe(true);
  });

  it.each(["a", "UPPER", "two words", "invalid!", "x".repeat(81)])("rejects %s", (name) => {
    expect(channelNameSchema.safeParse(name).success).toBe(false);
  });

  it("requires at least one update field", () => {
    expect(updateChannelSchema.safeParse({}).success).toBe(false);
    expect(updateChannelSchema.safeParse({ description: null }).success).toBe(true);
  });
});
