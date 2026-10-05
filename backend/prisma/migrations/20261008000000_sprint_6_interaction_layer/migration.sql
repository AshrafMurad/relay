CREATE TABLE "MessageReaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "messageId" uuid NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");

CREATE TABLE "ChannelReadState" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channelId" uuid NOT NULL REFERENCES "Channel"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "lastReadMessageId" uuid REFERENCES "Message"("id"),
  "lastReadAt" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "ChannelReadState_channelId_userId_key" ON "ChannelReadState"("channelId", "userId");
CREATE INDEX "ChannelReadState_userId_idx" ON "ChannelReadState"("userId");
CREATE INDEX "ChannelReadState_lastReadMessageId_idx" ON "ChannelReadState"("lastReadMessageId");

CREATE TABLE "DirectConversationReadState" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "directConversationId" uuid NOT NULL REFERENCES "DirectConversation"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "lastReadMessageId" uuid REFERENCES "Message"("id"),
  "lastReadAt" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "DirectConversationReadState_directConversationId_userId_key" ON "DirectConversationReadState"("directConversationId", "userId");
CREATE INDEX "DirectConversationReadState_userId_idx" ON "DirectConversationReadState"("userId");
CREATE INDEX "DirectConversationReadState_lastReadMessageId_idx" ON "DirectConversationReadState"("lastReadMessageId");
