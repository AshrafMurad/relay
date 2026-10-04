import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canInviteRole } from "../src/modules/workspaces/workspace.service.js";

describe("workspace invitation permissions", () => {
  it("allows owners to invite admins and members only", () => {
    expect(canInviteRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)).toBe(true);
    expect(canInviteRole(WorkspaceRole.OWNER, WorkspaceRole.MEMBER)).toBe(true);
    expect(canInviteRole(WorkspaceRole.OWNER, WorkspaceRole.OWNER)).toBe(false);
  });

  it("allows admins to invite members only", () => {
    expect(canInviteRole(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)).toBe(true);
    expect(canInviteRole(WorkspaceRole.ADMIN, WorkspaceRole.ADMIN)).toBe(false);
    expect(canInviteRole(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)).toBe(false);
  });

  it("does not allow members to invite workspace users", () => {
    expect(canInviteRole(WorkspaceRole.MEMBER, WorkspaceRole.MEMBER)).toBe(false);
    expect(canInviteRole(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN)).toBe(false);
  });
});
