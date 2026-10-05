CREATE TABLE "DirectConversation" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" uuid NOT NULL,
  "participantKey" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectConversationMember" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  CONSTRAINT "DirectConversationMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Message" ADD COLUMN "directConversationId" uuid;
ALTER TABLE "Message" ALTER COLUMN "channelId" DROP NOT NULL;

CREATE UNIQUE INDEX "DirectConversation_workspaceId_participantKey_key" ON "DirectConversation"("workspaceId", "participantKey");
CREATE INDEX "DirectConversation_workspaceId_updatedAt_idx" ON "DirectConversation"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX "DirectConversation_id_workspaceId_key" ON "DirectConversation"("id", "workspaceId");
CREATE UNIQUE INDEX "DirectConversationMember_conversationId_userId_key" ON "DirectConversationMember"("conversationId", "userId");
CREATE INDEX "DirectConversationMember_userId_idx" ON "DirectConversationMember"("userId");
CREATE INDEX "Message_directConversationId_createdAt_id_idx" ON "Message"("directConversationId", "createdAt", "id");

ALTER TABLE "DirectConversation" ADD CONSTRAINT "DirectConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectConversationMember" ADD CONSTRAINT "DirectConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_directConversationId_workspaceId_fkey" FOREIGN KEY ("directConversationId", "workspaceId") REFERENCES "DirectConversation"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_exactly_one_conversation_check" CHECK (("channelId" IS NOT NULL AND "directConversationId" IS NULL) OR ("channelId" IS NULL AND "directConversationId" IS NOT NULL));
