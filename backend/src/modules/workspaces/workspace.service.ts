import { createHash, randomBytes } from "node:crypto";

import { Prisma, type PrismaClient, type User, WorkspaceRole } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkspaceDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  currentUserRole: WorkspaceRole;
}

export interface WorkspaceMemberDTO {
  id: string;
  userId: string;
  email: string;
  name: string;
  image: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitationDTO {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface WorkspaceInvitationPreviewDTO {
  workspaceName: string;
  emailHint: string;
  role: Exclude<WorkspaceRole, "OWNER">;
  status: "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function invitationStatus(invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }): WorkspaceInvitationPreviewDTO["status"] {
  if (invitation.acceptedAt) return "ACCEPTED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt <= new Date()) return "EXPIRED";
  return "PENDING";
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

function slugify(name: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "workspace";
}

async function uniqueSlug(prisma: PrismaClient | Prisma.TransactionClient, name: string) {
  const base = slugify(name);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function requireWorkspaceMember(
  prisma: PrismaClient | Prisma.TransactionClient,
  workspaceId: string,
  userId: string,
) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member || member.status !== "ACTIVE") {
    throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
  }
  return member;
}

export function canInviteRole(actorRole: WorkspaceRole, inviteRole: WorkspaceRole) {
  return (actorRole === "OWNER" && inviteRole !== "OWNER") || (actorRole === "ADMIN" && inviteRole === "MEMBER");
}

export function canRemoveMember(actorRole: WorkspaceRole, targetRole: WorkspaceRole) {
  return targetRole !== "OWNER" && (actorRole === "OWNER" || (actorRole === "ADMIN" && targetRole === "MEMBER"));
}

function assertCanInvite(actorRole: WorkspaceRole, inviteRole: WorkspaceRole) {
  if (inviteRole === "OWNER") throw new ApiError(403, "FORBIDDEN", "Owner invitations are not supported.");
  if (canInviteRole(actorRole, inviteRole)) return;
  throw new ApiError(403, "FORBIDDEN", "You do not have permission to invite that role.");
}

export function toWorkspaceDTO(workspace: { id: string; name: string; slug: string; imageUrl: string | null; createdAt: Date; updatedAt: Date }, role: WorkspaceRole): WorkspaceDTO {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    imageUrl: workspace.imageUrl,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    currentUserRole: role,
  };
}

function toMemberDTO(member: { id: string; userId: string; role: WorkspaceRole; joinedAt: Date; user: Pick<User, "email" | "name" | "image"> }): WorkspaceMemberDTO {
  return {
    id: member.id,
    userId: member.userId,
    email: member.user.email,
    name: member.user.name,
    image: member.user.image,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}

function toInvitationDTO(invitation: { id: string; workspaceId: string; email: string; role: WorkspaceRole; invitedById: string; expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null; createdAt: Date }): WorkspaceInvitationDTO {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    invitedById: invitation.invitedById,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export async function createWorkspace(prisma: PrismaClient, userId: string, input: { name: string; imageUrl?: string }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new ApiError(400, "VALIDATION_ERROR", "Workspace name must be 2 to 120 characters.");

  return prisma.$transaction(async (transaction) => {
    const workspace = await transaction.workspace.create({
      data: {
        name,
        slug: await uniqueSlug(transaction, name),
        imageUrl: input.imageUrl?.trim() || null,
        createdById: userId,
      },
    });
    await transaction.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: "OWNER" },
    });
    await transaction.channel.create({
      data: { workspaceId: workspace.id, createdById: userId, name: "general" },
    });
    return toWorkspaceDTO(workspace, "OWNER");
  });
}

export async function listWorkspaces(prisma: PrismaClient, userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, status: "ACTIVE" },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  return memberships.map((membership) => toWorkspaceDTO(membership.workspace, membership.role));
}

export async function getWorkspace(prisma: PrismaClient, workspaceId: string, userId: string) {
  const member = await requireWorkspaceMember(prisma, workspaceId, userId);
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new ApiError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
  return toWorkspaceDTO(workspace, member.role);
}

export async function updateWorkspace(prisma: PrismaClient, workspaceId: string, actorId: string, input: { name: string }) {
  const actor = await requireWorkspaceMember(prisma, workspaceId, actorId);
  if (actor.role !== "OWNER") throw new ApiError(403, "FORBIDDEN", "Only the workspace owner can update workspace settings.");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new ApiError(400, "VALIDATION_ERROR", "Workspace name must be 2 to 120 characters.");
  const workspace = await prisma.workspace.update({ where: { id: workspaceId }, data: { name } });
  return toWorkspaceDTO(workspace, actor.role);
}

export async function listMembers(prisma: PrismaClient, workspaceId: string, userId: string) {
  await requireWorkspaceMember(prisma, workspaceId, userId);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: { user: { select: { email: true, name: true, image: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return members.map(toMemberDTO);
}

export async function updateMemberRole(prisma: PrismaClient, workspaceId: string, memberId: string, actorId: string, role: Exclude<WorkspaceRole, "OWNER">) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId}::uuid FOR UPDATE`);
    const actor = await requireWorkspaceMember(transaction, workspaceId, actorId);
    if (actor.role !== "OWNER") throw new ApiError(403, "FORBIDDEN", "Only the workspace owner can change member roles.");
    const target = await transaction.workspaceMember.findFirst({
      where: { id: memberId, workspaceId, status: "ACTIVE" },
      include: { user: { select: { email: true, name: true, image: true } } },
    });
    if (!target) throw new ApiError(404, "MEMBER_NOT_FOUND", "Workspace member was not found.");
    if (target.role === "OWNER") throw new ApiError(403, "FORBIDDEN", "Workspace ownership cannot be changed.");
    const updated = await transaction.workspaceMember.update({
      where: { id: target.id },
      data: { role },
      include: { user: { select: { email: true, name: true, image: true } } },
    });
    return toMemberDTO(updated);
  });
}

export async function removeMember(prisma: PrismaClient, workspaceId: string, memberId: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId}::uuid FOR UPDATE`);
    const actor = await requireWorkspaceMember(transaction, workspaceId, actorId);
    const target = await transaction.workspaceMember.findFirst({ where: { id: memberId, workspaceId, status: "ACTIVE" } });
    if (!target) throw new ApiError(404, "MEMBER_NOT_FOUND", "Workspace member was not found.");
    if (!canRemoveMember(actor.role, target.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to remove this member.");
    await transaction.workspaceMember.update({
      where: { id: target.id },
      data: { status: "REMOVED", removedAt: new Date(), removedById: actorId },
    });
    return { memberId: target.id, userId: target.userId };
  });
}

export async function createInvitation(
  prisma: PrismaClient,
  workspaceId: string,
  actorId: string,
  input: { email: string; role: WorkspaceRole },
) {
  const actor = await requireWorkspaceMember(prisma, workspaceId, actorId);
  assertCanInvite(actor.role, input.role);
  const email = normalizeInvitationEmail(input.email);
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      select: { status: true },
    });
    if (existingMember?.status === "ACTIVE") throw new ApiError(409, "ALREADY_MEMBER", "This person is already a workspace member.");
  }
  const pendingInvitation = await prisma.workspaceInvitation.findFirst({
    where: { workspaceId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (pendingInvitation) throw new ApiError(409, "INVITATION_PENDING", "A pending invitation already exists for this email address.");
  const token = createToken();
  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      email,
      role: input.role,
      tokenHash: hashToken(token),
      invitedById: actorId,
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
    },
  });
  return { invitation: toInvitationDTO(invitation), token };
}

export async function getInvitationPreview(prisma: PrismaClient, token: string): Promise<WorkspaceInvitationPreviewDTO> {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { workspace: { select: { name: true } } },
  });
  if (!invitation) throw new ApiError(404, "INVITATION_INVALID", "Invitation was not found.");
  return {
    workspaceName: invitation.workspace.name,
    emailHint: maskEmail(invitation.email),
    role: invitation.role as Exclude<WorkspaceRole, "OWNER">,
    status: invitationStatus(invitation),
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export async function listInvitations(prisma: PrismaClient, workspaceId: string, actorId: string) {
  const actor = await requireWorkspaceMember(prisma, workspaceId, actorId);
  if (actor.role === "MEMBER") throw new ApiError(403, "FORBIDDEN", "You do not have permission to view invitations.");
  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return invitations.map(toInvitationDTO);
}

export async function revokeInvitation(prisma: PrismaClient, workspaceId: string, invitationId: string, actorId: string) {
  const actor = await requireWorkspaceMember(prisma, workspaceId, actorId);
  const invitation = await prisma.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId } });
  if (!invitation) throw new ApiError(404, "INVITATION_INVALID", "Invitation was not found.");
  if (actor.role === "MEMBER" || (actor.role === "ADMIN" && invitation.role !== "MEMBER")) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to revoke this invitation.");
  }
  if (invitation.acceptedAt) throw new ApiError(409, "INVITATION_ALREADY_USED", "Invitation has already been accepted.");
  if (invitation.revokedAt) throw new ApiError(409, "INVITATION_INVALID", "Invitation has already been revoked.");

  const revoked = await prisma.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });
  return toInvitationDTO(revoked);
}

export async function acceptInvitation(prisma: PrismaClient, token: string, user: User) {
  const tokenHash = hashToken(token);
  return prisma.$transaction(async (transaction) => {
    const invitation = await transaction.workspaceInvitation.findUnique({ where: { tokenHash } });
    if (!invitation) throw new ApiError(404, "INVITATION_INVALID", "Invitation was not found.");
    if (invitation.acceptedAt) throw new ApiError(409, "INVITATION_ALREADY_USED", "Invitation has already been accepted.");
    if (invitation.revokedAt) throw new ApiError(409, "INVITATION_INVALID", "Invitation has been revoked.");
    if (invitation.expiresAt <= new Date()) throw new ApiError(410, "INVITATION_EXPIRED", "Invitation has expired.");
    if (normalizeInvitationEmail(user.email) !== invitation.email) {
      throw new ApiError(403, "FORBIDDEN", "Sign in with the invited email address to accept this invitation.");
    }

    const acceptance = await transaction.workspaceInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    });
    if (acceptance.count !== 1) throw new ApiError(409, "INVITATION_ALREADY_USED", "Invitation is no longer available.");

    const existingMember = await transaction.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
    });
    const role = existingMember?.status === "ACTIVE" ? existingMember.role : invitation.role;
    if (!existingMember) {
      await transaction.workspaceMember.create({
        data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
      });
    } else if (existingMember.status === "REMOVED") {
      await transaction.workspaceMember.update({
        where: { id: existingMember.id },
        data: { role: invitation.role, status: "ACTIVE", removedAt: null, removedById: null },
      });
    }

    const accepted = await transaction.workspaceInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    const workspace = await transaction.workspace.findUniqueOrThrow({ where: { id: invitation.workspaceId } });
    return { invitation: toInvitationDTO(accepted), workspace: toWorkspaceDTO(workspace, role) };
  });
}
