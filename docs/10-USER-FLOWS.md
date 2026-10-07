# Relay — User Flows

## 1. Authenticated Workspace Entry

```text
Landing
→ Sign Up / Sign In
→ Verify Email When Required
→ Invitation Pending? Continue Invitation
→ Otherwise Load Active Memberships
→ Enter Last-Used or Sole Workspace
→ Or Choose Workspace
→ Or, With No Memberships, Create or Join
```

Creating a workspace atomically creates the Owner membership and default `general` channel, then enters the workspace directly. Joining requires an invitation link. Email/password registration inserts an email-verification step before profile/workspace access. Google OAuth returns directly to the pending-invitation or workspace decision after the verified provider callback. A verified Google account and verified credential account with the same email resolve to one Relay user.

## 2. Invitation Flow

```text
Invitation Link
→ Validate Token
→ Sign In / Sign Up
→ Accept Invitation
→ Membership Created
→ Enter Workspace
```

The invitation destination is preserved through authentication. Invalid, expired, revoked, already-used, and wrong-account invitations have explicit states. An existing active membership keeps its current role; only a removed membership is reactivated with the invitation role.

## 3. Create Channel

```text
Workspace
→ Add Channel
→ Enter Name/Description
→ Validate Permission
→ Create
→ Channel Appears in Sidebar
→ Navigate to Channel
```

## 4. Channel Messaging

```text
Open Channel
→ Load Recent Messages
→ Connect/Subscribe
→ Type Message
→ Optimistic Render
→ Send Socket Event
→ Server Persists
→ Ack Sender
→ Broadcast to Members
```

## 5. Failed Send

```text
Send
→ Optimistic Message
→ Failure / Timeout
→ Mark Failed
→ User Chooses Retry
→ Resend Using Operation ID
→ Reconcile Canonical Message
```

## 6. Direct Message

```text
Start DM
→ Select Workspace Member
→ Find/Create Conversation
→ Open DM
→ Load History
→ Subscribe
→ Send/Receive Messages
```

## 7. Reaction

```text
Hover Message
→ Add Reaction
→ Select Emoji
→ Server Authorizes/Persists
→ Broadcast Update
→ All Clients Reconcile
```

## 8. Reply

```text
Message Actions
→ Reply
→ Composer Shows Reply Context
→ Send Message with parentMessageId
→ Reply Rendered with Context
```

## 9. Upload Attachment

```text
Composer
→ Select File
→ Validate Client-Side
→ Upload
→ Server Validates
→ Receive Attachment ID
→ Send Message Referencing Attachment
```

Pending uploads are scoped to the current user and workspace, may only be attached once, and expire after 24 hours if no message references them.

## 10. Read State

```text
Open Conversation
→ Render Messages
→ Determine Latest Visible Message
→ Send Read Update
→ Persist Read State
→ Unread Count Clears
```

## 11. Reconnect

```text
Connection Lost
→ Show Non-Disruptive Connection State
→ Socket Reconnect Attempt
→ Reauthenticate
→ Restore Subscriptions
→ Fetch Missed Durable Messages
→ Reconcile State
→ Resume Normal Operation
```

## 12. Workspace Member Removal

```text
Admin Removes Member
→ Membership Revoked
→ Active Socket Authorization Updated
→ User Leaves Workspace Rooms
→ Further Workspace Access Denied
→ UI Redirects User Out of Workspace
```
