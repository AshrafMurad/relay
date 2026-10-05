import { z } from "zod";

export const MESSAGE_MAX_CODE_POINTS = 4_000;
export const DEFAULT_MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;

export const createMessageSchema = z.object({
  operationId: z.string().uuid(),
  content: z.string(),
  parentMessageId: z.string().uuid().nullable().optional(),
});

export const editMessageSchema = z.object({ content: z.string() });
export const reactionToggleSchema = z.object({ emoji: z.string().trim().emoji().max(16) });
export const conversationReadSchema = z.object({ messageId: z.string().uuid() });
export const channelMessageParamsSchema = z.object({ channelId: z.string().uuid() });
export const directMessageParamsSchema = z.object({ conversationId: z.string().uuid() });
export const messageParamsSchema = z.object({ messageId: z.string().uuid() });
export const messageHistoryQuerySchema = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_MESSAGE_PAGE_SIZE).default(DEFAULT_MESSAGE_PAGE_SIZE),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type ReactionToggleInput = z.infer<typeof reactionToggleSchema>;
export type ConversationReadInput = z.infer<typeof conversationReadSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;

export interface ReactionSummaryDTO {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ConversationReadStateDTO {
  workspaceId: string;
  conversation: { type: "channel" | "dm"; id: string };
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

export interface MessageDTO {
  id: string;
  workspaceId: string;
  channelId: string | null;
  directConversationId: string | null;
  operationId: string;
  author: { id: string; name: string; image: string | null };
  content: string;
  parentMessageId: string | null;
  parent: { id: string; authorName: string; content: string; deletedAt: string | null } | null;
  reactions: ReactionSummaryDTO[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageHistoryDTO {
  messages: MessageDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}
