# Relay — Testing Strategy

## 1. Testing Priorities

Relay's highest-risk areas are:

- authorization;
- real-time state synchronization;
- reconnect behavior;
- message deduplication;
- unread state;
- multi-session presence.

Testing effort should prioritize these over superficial component coverage.

## 2. Unit Tests

Test domain/service logic such as:

- role checks;
- invitation validation;
- message validation;
- reaction toggle behavior;
- read state calculations;
- presence aggregation helpers;
- event payload validation.
- message code-point and attachment-size limits;
- cursor encode/decode and deterministic `(createdAt, id)` ordering;
- canonical DM participant-key generation.

## 3. Integration Tests

Test Express + database behavior for:

- workspace isolation;
- channel creation permissions;
- message persistence;
- message edit/delete rules;
- direct conversation access;
- invitations;
- search scoping;
- attachment metadata permissions.
- email verification and password-reset expiry;
- Google and credential account linking by verified email;
- session expiry, refresh, logout, and password-reset revocation;
- duplicate message operation IDs returning one durable message;
- archived channel read-only behavior;
- pending upload expiry and workspace quota enforcement.
- atomic workspace/Owner creation and prohibited Owner role transitions;
- concurrent invitation acceptance/revocation with exactly one terminal outcome;
- monotonic read updates from multiple tabs;
- attachment status checks and one-time attachment;
- workspace sync pagination, authorization filtering, and canonical hydration.

## 4. WebSocket Integration Tests

Test with multiple connected clients.

Required scenarios:

- client A sends, client B receives;
- unauthorized user cannot join channel context;
- reactions propagate;
- typing propagates but is not persisted;
- disconnect updates presence;
- multiple tabs preserve online state;
- removed member loses access;
- reconnect restores communication;
- expired or revoked sessions fail a reconnect handshake;
- Redis outage disables ephemeral state without losing durable messages.

## 5. E2E Tests

Use Playwright for critical flows:

1. sign up;
2. verify email or sign in with Google;
3. create workspace;
4. invite member;
5. accept invite;
6. create channel;
7. send channel message;
8. receive real-time message in second browser context;
9. start DM;
10. send reaction/reply;
11. unread state update.

## 6. Reconnection Tests

Simulate network interruption.

Verify:

- connection state displayed;
- new messages sent by other client during outage persist;
- disconnected client reconnects;
- missed messages are synchronized;
- missed edits, deletes, reactions, read state, and archive changes are synchronized;
- no duplicates appear.

## 7. Permission Matrix Tests

Roles:

- Owner
- Admin
- Member
- Non-member

Resources:

- workspace;
- members;
- invitations;
- channel;
- message;
- attachment;
- DM.

Every protected operation should have explicit expected access.

## 8. Load / Performance Checks

V1 does not require enterprise load certification, but perform pragmatic tests for:

- many messages in one channel;
- history pagination;
- several simultaneous sockets;
- rapid typing signals;
- reaction bursts;
- Redis pub/sub behavior if multi-instance testing is enabled.

## 9. UI Tests

Focus on:

- loading states;
- empty states;
- failed send state;
- retry;
- mobile navigation;
- unread indicators;
- connection state;
- keyboard accessibility.

## 10. Definition of Tested V1

V1 is not complete until real-time flows have been tested with at least two independent browser sessions/users.
