CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'ATTACHED');

CREATE TABLE "Attachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "uploaderId" UUID NOT NULL,
  "messageId" UUID,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attachedAt" TIMESTAMPTZ(6),
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceSyncEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "eventType" TEXT NOT NULL,
  "channelId" UUID,
  "directConversationId" UUID,
  "messageId" UUID,
  "userId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");
CREATE INDEX "Attachment_workspaceId_status_idx" ON "Attachment"("workspaceId", "status");
CREATE INDEX "Attachment_uploaderId_status_expiresAt_idx" ON "Attachment"("uploaderId", "status", "expiresAt");
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");
CREATE UNIQUE INDEX "WorkspaceSyncEvent_workspaceId_sequence_key" ON "WorkspaceSyncEvent"("workspaceId", "sequence");
CREATE INDEX "WorkspaceSyncEvent_workspaceId_sequence_idx" ON "WorkspaceSyncEvent"("workspaceId", "sequence");
CREATE INDEX "WorkspaceSyncEvent_channelId_idx" ON "WorkspaceSyncEvent"("channelId");
CREATE INDEX "WorkspaceSyncEvent_directConversationId_idx" ON "WorkspaceSyncEvent"("directConversationId");
CREATE INDEX "WorkspaceSyncEvent_messageId_idx" ON "WorkspaceSyncEvent"("messageId");
CREATE INDEX "Message_content_search_idx" ON "Message" USING GIN (to_tsvector('simple', "content")) WHERE "deletedAt" IS NULL;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSyncEvent" ADD CONSTRAINT "WorkspaceSyncEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_status_message_check" CHECK (("status" = 'PENDING' AND "messageId" IS NULL) OR ("status" = 'ATTACHED' AND "messageId" IS NOT NULL));
