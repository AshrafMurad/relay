import { z } from "zod";

export const channelNameSchema = z.string().regex(
  /^[a-z0-9_-]{2,80}$/,
  "Channel names must be 2 to 80 lowercase letters, numbers, hyphens, or underscores.",
);

export const createChannelSchema = z.object({
  name: channelNameSchema,
  description: z.string().optional().nullable(),
});

export const updateChannelSchema = z.object({
  name: channelNameSchema.optional(),
  description: z.string().optional().nullable(),
}).refine((input) => input.name !== undefined || input.description !== undefined, {
  message: "At least one channel field is required.",
});

export const workspaceParamsSchema = z.object({ workspaceId: z.string().uuid() });
export const channelParamsSchema = z.object({ channelId: z.string().uuid() });

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

export interface ChannelDTO {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
