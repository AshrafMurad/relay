# Relay — Security & Permissions

## 1. Security Goal

No user should be able to access data or real-time events outside workspaces and conversations they are authorized to use.

## 2. Authentication

- Better Auth is hosted by Express.
- Email/password and Google OAuth are supported.
- Email/password sign-in requires verified email.
- Passwords contain 12 to 128 characters and use Better Auth's scrypt hashing.
- Sessions are opaque, stored in PostgreSQL, and expire after 7 days with a 24-hour refresh interval.
- Cookie session caching is disabled so revocation is immediate.
- Session cookies are HttpOnly, Secure in production, SameSite=Lax, and host-only.
- Session validation on HTTP requests.
- Session validation during WebSocket handshake.
- Session validation again after every socket reconnect.
- Password reset revokes every existing session for the user.
- Google requests only `openid`, `email`, and `profile`; Relay does not request offline access.
- Stored OAuth tokens use Better Auth's token encryption derived from `BETTER_AUTH_SECRET`.
- Password/email changes, provider linking/unlinking, and revoking all other sessions require a session no older than 15 minutes.
- A stale session receives `SESSION_NOT_FRESH` and must reauthenticate before retrying the protected action.

## 3. Authorization Layers

### Workspace-level
Verify active workspace membership.

### Role-level
Verify Owner/Admin/Member permission for protected actions.

### Conversation-level
Verify channel or DM access.

### Resource-level
Verify message/attachment ownership or administrative permission.

## 4. WebSocket Security

- Authenticate before accepting privileged events.
- Never trust room membership alone.
- Validate every incoming payload.
- Re-check authorization for sensitive actions.
- Remove sockets from rooms when membership changes.
- Apply rate limiting.

## 5. Workspace Isolation

Queries must include workspace context where appropriate.

Never fetch by resource ID alone and then assume workspace ownership.

## 6. Input Validation

Use server-side validation for:

- message content;
- channel names;
- workspace values;
- invitation data;
- file uploads;
- socket event payloads.

## 7. Attachments

- enforce max file size;
- allow-list supported MIME types/extensions;
- generate safe storage keys;
- never trust client-provided file names as paths;
- protect file access according to message authorization;
- reject path traversal and keep the upload directory outside public static assets;
- serve files through an authorization-checked backend endpoint.
- limit each file to 25 MiB, each message to 5 files and 50 MiB combined, and each workspace to 5 GiB by default;
- remove pending uploads that remain unattached for 24 hours;
- allow only JPEG, PNG, GIF, WebP, PDF, plain text, CSV, JSON, and ZIP after MIME and extension validation;
- reject SVG, HTML, scripts, executables, and unrecognized MIME/extension combinations.

## 8. XSS / Message Content

If V1 messages are plain text, render them safely as text.

If rich text is added later, sanitize content carefully.

## 9. Rate Limiting

Protect:

- login endpoints;
- invitation attempts;
- message send events;
- typing events;
- reaction events;
- search endpoints;
- file uploads.

Concrete limits are defined in `16-SPRINT-0-DECISIONS.md`. Redis coordinates distributed limits. During a Redis outage, the single-instance V1 backend enforces the same numeric limits with in-process counters rather than running unprotected.

## 10. Sensitive Logging

Do not log:

- passwords;
- raw auth tokens;
- secure cookies;
- private file URLs with long-lived credentials.
- email verification and password-reset links or tokens.
- OAuth access, refresh, or ID tokens.

## 11. Auditability

V1 does not require enterprise audit logs, but security-relevant server logs should exist for:

- failed authentication;
- repeated forbidden actions;
- invitation abuse;
- upload validation failures;
- unexpected socket events.
