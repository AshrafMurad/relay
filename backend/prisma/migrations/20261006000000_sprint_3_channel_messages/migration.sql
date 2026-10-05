CREATE TABLE "Message" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "channelId" UUID NOT NULL,
  "authorId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "parentMessageId" UUID,
  "content" TEXT NOT NULL,
  "editedAt" TIMESTAMPTZ(6),
  "deletedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Message_content_length_check" CHECK (char_length("content") <= 4000),
  CONSTRAINT "Message_deleted_content_check" CHECK ("deletedAt" IS NULL OR "content" = '')
);

CREATE UNIQUE INDEX "Message_authorId_operationId_key" ON "Message" ("authorId", "operationId");
CREATE UNIQUE INDEX "Channel_id_workspaceId_key" ON "Channel" ("id", "workspaceId");
CREATE INDEX "Message_channelId_createdAt_id_idx" ON "Message" ("channelId", "createdAt", "id");
CREATE INDEX "Message_workspaceId_idx" ON "Message" ("workspaceId");
CREATE INDEX "Message_parentMessageId_idx" ON "Message" ("parentMessageId");
CREATE INDEX "Message_authorId_idx" ON "Message" ("authorId");

ALTER TABLE "Message" ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_workspaceId_fkey" FOREIGN KEY ("channelId", "workspaceId") REFERENCES "Channel"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
