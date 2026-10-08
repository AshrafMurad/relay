import { WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canInviteRole, canRemoveMember } from "../src/modules/workspaces/workspace.service.js";

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

describe("workspace member removal permissions", () => {
  it("allows owners to remove admins and members but never owners", () => {
    expect(canRemoveMember(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)).toBe(true);
    expect(canRemoveMember(WorkspaceRole.OWNER, WorkspaceRole.MEMBER)).toBe(true);
    expect(canRemoveMember(WorkspaceRole.OWNER, WorkspaceRole.OWNER)).toBe(false);
  });

  it("only allows admins to remove members", () => {
    expect(canRemoveMember(WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)).toBe(true);
    expect(canRemoveMember(WorkspaceRole.ADMIN, WorkspaceRole.ADMIN)).toBe(false);
    expect(canRemoveMember(WorkspaceRole.MEMBER, WorkspaceRole.MEMBER)).toBe(false);
  });
});
