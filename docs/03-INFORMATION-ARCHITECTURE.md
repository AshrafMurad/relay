# Relay — Information Architecture

## 1. Top-Level Product Structure

Relay is organized around a workspace context.

```text
Relay
├── Authentication
├── Workspace
│   ├── Channels
│   ├── Direct Messages
│   ├── Search
│   ├── Members
│   └── Workspace Settings
└── User Settings
```

## 2. Main Application Shell

### Workspace Switcher / Identity
Shows the active workspace and allows navigation to workspace-level actions.

### Primary Sidebar
Contains:

- workspace identity;
- channel list;
- direct message list;
- add channel action;
- start DM action;
- members/settings entry points.

### Conversation Area
Contains:

- conversation header;
- message history;
- unread marker;
- typing state;
- message composer;
- attachment handling.

### Optional Context Panel
Reserved for lightweight contextual details such as channel information or member details. It should not become a required layout dependency for V1.

## 3. Core Routes

Suggested route structure:

```text
/
/login
/signup
/invite/:token

/app
/app/:workspaceSlug
/app/:workspaceSlug/channels/:channelId
/app/:workspaceSlug/dm/:conversationId
/app/:workspaceSlug/search
/app/:workspaceSlug/members
/app/:workspaceSlug/settings
/settings/profile
```

Exact route naming may change during implementation.

## 4. Channel Navigation

The user should be able to:

1. See all accessible channels.
2. See which channel is active.
3. See unread indicators.
4. Create a new channel if authorized.
5. Navigate without full-page reloads.

## 5. Direct Message Navigation

The DM section should show recent direct conversations ordered primarily by recent activity.

Each DM entry may show:

- user name;
- avatar;
- presence indicator;
- unread count/state.

## 6. Conversation Header

Channel header:

- channel name;
- optional description/topic;
- member/context action;

DM header:

- participant name;
- presence;
- optional last seen state.

## 7. Message Composer

The composer should support:

- text entry;
- send action;
- multiline input;
- attachment action;
- reply context;
- send failure/retry state.

## 8. Responsive Behavior

### Desktop
Persistent navigation sidebar and conversation panel.

### Tablet
Sidebar may collapse.

### Mobile
Use a conversation-first layout with navigation available through a drawer or dedicated panel. Do not attempt to preserve a desktop multi-column layout at all costs.

## 9. UX Priority

The user should always be able to answer three questions instantly:

1. Which workspace am I in?
2. Which conversation am I viewing?
3. Is there unread activity elsewhere?
