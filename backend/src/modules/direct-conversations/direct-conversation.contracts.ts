import { z } from "zod";

export const directConversationParamsSchema = z.object({ conversationId: z.string().uuid() });
export const createDirectConversationSchema = z.object({ userId: z.string().uuid() });

export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;

export interface DirectConversationDTO {
  id: string;
  workspaceId: string;
  participantKey: string;
  otherUser: { id: string; name: string; email: string; image: string | null };
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}
