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

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return randomBytes(32).toString("base64url");
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

function assertCanInvite(actorRole: WorkspaceRole, inviteRole: WorkspaceRole) {
  if (inviteRole === "OWNER") throw new ApiError(403, "FORBIDDEN", "Owner invitations are not supported.");
  if (canInviteRole(actorRole, inviteRole)) return;
  throw new ApiError(403, "FORBIDDEN", "You do not have permission to invite that role.");
}

function toWorkspaceDTO(workspace: { id: string; name: string; slug: string; imageUrl: string | null; createdAt: Date; updatedAt: Date }, role: WorkspaceRole): WorkspaceDTO {
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

export async function listMembers(prisma: PrismaClient, workspaceId: string, userId: string) {
  await requireWorkspaceMember(prisma, workspaceId, userId);
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    include: { user: { select: { email: true, name: true, image: true } } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return members.map(toMemberDTO);
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

export async function listInvitations(prisma: PrismaClient, workspaceId: string, actorId: string) {
  const actor = await requireWorkspaceMember(prisma, workspaceId, actorId);
  if (actor.role === "MEMBER") throw new ApiError(403, "FORBIDDEN", "You do not have permission to view invitations.");
  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return invitations.map(toInvitationDTO);
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

    await transaction.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
      create: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
      update: { role: invitation.role, status: "ACTIVE", removedAt: null, removedById: null },
    });
    const accepted = await transaction.workspaceInvitation.update({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    });
    const workspace = await transaction.workspace.findUniqueOrThrow({ where: { id: invitation.workspaceId } });
    return { invitation: toInvitationDTO(accepted), workspace: toWorkspaceDTO(workspace, invitation.role) };
  });
}
