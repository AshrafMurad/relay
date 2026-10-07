import { WorkspaceRole, type PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { createChannelSchema } from "../channels/channel.contracts.js";
import { createChannel, listChannels } from "../channels/channel.service.js";
import { getWorkspaceSync, syncQuerySchema } from "../sync/sync.service.js";
import { acceptInvitation, createInvitation, createWorkspace, getInvitationPreview, getWorkspace, listInvitations, listMembers, listWorkspaces, revokeInvitation } from "./workspace.service.js";

const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(120),
  imageUrl: z.string().url().optional(),
});

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER]),
});

const acceptInvitationSchema = z.object({ token: z.string().min(16) });
const paramsSchema = z.object({ workspaceId: z.string().uuid() });
const invitationParamsSchema = z.object({ workspaceId: z.string().uuid(), invitationId: z.string().uuid() });
const tokenParamsSchema = z.object({ token: z.string().min(16) });

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Request data is invalid.");
  return parsed.data;
}

export function createWorkspaceRouter(prisma: PrismaClient) {
  const router = Router();

  router.get("/invitations/:token", asyncHandler(async (request, response) => {
    const { token } = parse(tokenParamsSchema, request.params);
    const invitation = await getInvitationPreview(prisma, token);
    response.json({ invitation });
  }));

  router.use(requireAuth);

  router.get("/", asyncHandler(async (request, response) => {
    const workspaces = await listWorkspaces(prisma, request.authUser!.id);
    response.json({ workspaces });
  }));

  router.post("/", asyncHandler(async (request, response) => {
    const input = parse(createWorkspaceSchema, request.body);
    const workspace = await createWorkspace(prisma, request.authUser!.id, input);
    response.status(201).json({ workspace });
  }));

  router.get("/:workspaceId", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const workspace = await getWorkspace(prisma, workspaceId, request.authUser!.id);
    response.json({ workspace });
  }));

  router.get("/:workspaceId/channels", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const channels = await listChannels(prisma, workspaceId, request.authUser!.id);
    response.json({ channels });
  }));

  router.get("/:workspaceId/sync", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const query = parse(syncQuerySchema, request.query);
    const sync = await getWorkspaceSync(prisma, workspaceId, request.authUser!.id, query);
    response.json(sync);
  }));

  router.post("/:workspaceId/channels", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const input = parse(createChannelSchema, request.body);
    const channel = await createChannel(prisma, workspaceId, request.authUser!.id, input);
    response.status(201).json({ channel });
  }));

  router.get("/:workspaceId/members", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const members = await listMembers(prisma, workspaceId, request.authUser!.id);
    response.json({ members });
  }));

  router.get("/:workspaceId/invitations", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const invitations = await listInvitations(prisma, workspaceId, request.authUser!.id);
    response.json({ invitations });
  }));

  router.post("/:workspaceId/invitations", asyncHandler(async (request, response) => {
    const { workspaceId } = parse(paramsSchema, request.params);
    const input = parse(createInvitationSchema, request.body);
    const result = await createInvitation(prisma, workspaceId, request.authUser!.id, input);
    response.status(201).json(result);
  }));

  router.delete("/:workspaceId/invitations/:invitationId", asyncHandler(async (request, response) => {
    const { workspaceId, invitationId } = parse(invitationParamsSchema, request.params);
    const invitation = await revokeInvitation(prisma, workspaceId, invitationId, request.authUser!.id);
    response.json({ invitation });
  }));

  router.post("/invitations/accept", asyncHandler(async (request, response) => {
    const { token } = parse(acceptInvitationSchema, request.body);
    const result = await acceptInvitation(prisma, token, request.authUser!);
    response.json(result);
  }));

  return router;
}
