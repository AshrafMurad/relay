import { z } from "zod";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const WORKSPACE_STORAGE_QUOTA_BYTES = 5n * 1024n * 1024n * 1024n;

export const attachmentUploadBodySchema = z.object({ workspaceId: z.string().uuid() });
export const attachmentParamsSchema = z.object({ attachmentId: z.string().uuid() });

export interface PendingAttachmentDTO {
  id: string;
  workspaceId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
}
