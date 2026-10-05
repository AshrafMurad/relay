import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { channelParamsSchema, updateChannelSchema } from "./channel.contracts.js";
import { archiveChannel, restoreChannel, updateChannel } from "./channel.service.js";

function parse<T>(schema: z.ZodSchema<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request data is invalid.");
  return parsed.data;
}

export function createChannelRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth);

  router.patch("/:channelId", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelParamsSchema, request.params);
    const input = parse(updateChannelSchema, request.body);
    const channel = await updateChannel(prisma, channelId, request.authUser!.id, input);
    response.json({ channel });
  }));

  router.post("/:channelId/archive", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelParamsSchema, request.params);
    const channel = await archiveChannel(prisma, channelId, request.authUser!.id);
    response.json({ channel });
  }));

  router.post("/:channelId/restore", asyncHandler(async (request, response) => {
    const { channelId } = parse(channelParamsSchema, request.params);
    const channel = await restoreChannel(prisma, channelId, request.authUser!.id);
    response.json({ channel });
  }));

  return router;
}
