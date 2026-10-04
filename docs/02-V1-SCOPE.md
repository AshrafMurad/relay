# Relay — V1 Scope

## 1. V1 Objective

Build a production-minded real-time team communication application with enough depth to demonstrate real engineering complexity while keeping the product focused and finishable.

## 2. Included Features

### Authentication
- Email/password sign up with required email verification.
- Email/password sign in.
- Google OAuth sign in.
- Sign out.
- Database-backed session management.
- Password reset.
- Basic profile management.

### Workspaces
- Create workspace.
- Update workspace details.
- Invite members.
- Accept workspace invitations.
- View workspace members.
- Remove members where authorized.
- Workspace roles: Owner, Admin, Member.

### Channels
- Create channels.
- Public workspace channels in V1.
- Edit channel metadata where authorized.
- Archive channels.
- Browse workspace channels.

### Direct Messages
- One-to-one direct conversations.
- Persistent conversation history.
- Unread state.

### Messaging
- Send text messages.
- Edit own messages.
- Delete own messages subject to rules.
- Message timestamps.
- Basic delivery acknowledgement.
- Optimistic message rendering.
- Message retry/failure state.
- Pagination / infinite history loading.

### Replies
- Lightweight message replies.
- Reply context shown with the message.
- V1 does not require a full Slack-style thread side panel.

### Reactions
- Emoji reactions.
- Toggle own reaction.
- Real-time reaction updates.

### Presence
- Online/offline status.
- Last-seen fallback where appropriate.
- Presence scoped to authenticated workspace usage.

### Typing Indicators
- Typing events in channels and DMs.
- Automatic timeout/cleanup.
- Typing state remains ephemeral and is not stored permanently.

### Read / Unread
- Per-conversation read state.
- Unread counts.
- Last-read marker or equivalent state.
- Real-time unread updates.

### Attachments
- Upload supported files.
- Associate attachments with messages.
- Store metadata in PostgreSQL.
- Store files on the backend server filesystem using a persistent production volume.

### Search
- Search messages using PostgreSQL capabilities.
- Filter by current workspace.
- V1 does not require Elasticsearch.

### Notifications
- Dedicated durable notifications are deferred until mentions or another committed notification behavior requires them.
- Read/unread state covers core V1 activity awareness.

## 3. Optional V1+ Features

These may be added only after the core product is stable:

- @mentions.
- Pinned messages.
- Saved messages.
- Channel topics.
- Private channels.
- Browser notifications.
- Drag-and-drop uploads.
- Message link previews.

## 4. Explicitly Out of Scope

- Audio/video calling.
- Screen sharing.
- Bots.
- Workflow automation.
- External integrations marketplace.
- Enterprise audit/compliance center.
- Billing/subscriptions.
- Multi-region deployment.
- Advanced retention policies.
- End-to-end encryption.
- Massive public communities.

## 5. Scope Guardrail

A proposed feature should be rejected from V1 if it does not materially improve one of these areas:

- communication;
- real-time interaction;
- reliability;
- workspace organization;
- portfolio demonstration of distributed/realtime engineering.
