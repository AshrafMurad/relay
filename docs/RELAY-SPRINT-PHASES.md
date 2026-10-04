# Relay — Sprint Phases

## Working Rule

Use one fresh AI/OpenCode session per major sprint unless the sprint is extremely small. Each session should first read the relevant project documentation and inspect existing implementation before changing code.

Do not ask an implementation session to redesign the entire architecture unless a blocking technical issue is discovered.

---

# Sprint 0 — Project Foundation

## Objective
Create the technical foundation for Relay.

## Scope
- Independent `frontend` app with Next.js 16.
- Independent `backend` app with Express + Socket.IO.
- Separate package manifests, lockfiles, and configuration; no npm workspace.
- TypeScript configuration.
- PostgreSQL.
- Prisma.
- Redis.
- explicit API DTO and socket contract conventions.
- Docker dev environment.
- environment validation.
- lint/typecheck/test commands.

## Deliverables
- Both apps run locally.
- Database connection works.
- Redis connection works.
- API and socket contracts are explicit and can be represented safely in both applications.
- Basic CI-quality scripts exist.

## Out of Scope
- Product UI polish.
- Messaging.
- Presence.

## Definition of Done
A new developer can clone, configure environment variables, install dependencies, start all required services, and see both web and API health checks working.

---

# Sprint 1 — Authentication & Workspace System

## Objective
Build identity, workspace membership, roles, and invitations.

## Scope
- authentication;
- user profile basics;
- workspace creation;
- workspace membership;
- Owner/Admin/Member roles;
- workspace switching;
- invitations;
- authorization guards;
- authenticated socket handshake proof-of-concept.

## Deliverables
A user can create a workspace, invite another user, and both can enter the same workspace with correct permissions.

## Definition of Done
Unauthorized users cannot access workspace APIs or establish privileged socket context.

---

# Sprint 2 — Application Shell & Channels

## Objective
Create the usable communication shell.

## Scope
- workspace sidebar;
- channel navigation;
- channel creation;
- channel archive/update rules;
- conversation route;
- base responsive navigation;
- empty states.

## Design Note
Use functional Tailwind/shadcn styling. Do not spend excessive time on final visual polish because the dedicated Impeccable sprint comes later.

## Definition of Done
Users can navigate a workspace and create/open channels with correct permissions.

---

# Sprint 3 — Durable Messaging

## Objective
Build correct message persistence before advanced real-time behavior.

## Scope
- Message schema.
- Message history.
- Idempotent HTTP message creation through the backend message service.
- Pagination.
- Composer.
- Edit message.
- Delete message.
- Reply reference.
- Basic optimistic message model.

## Definition of Done
Messages can be created, persisted, loaded, edited, deleted, replied to, and paginated correctly using the backend source of truth.

---

# Sprint 4 — Real-Time Messaging Engine

## Objective
Turn durable messaging into a reliable live communication system.

## Scope
- Express HTTP server with Socket.IO attached.
- socket authentication.
- room authorization.
- `message:send`.
- acknowledgements.
- broadcast.
- optimistic reconciliation.
- send failure/retry.
- operation IDs.
- deduplication.

## Definition of Done
Two separate users can communicate instantly in the same channel. Failed/retried sends do not create duplicate durable messages.

---

# Sprint 5 — Direct Messages, Presence & Typing

## Objective
Add private communication and ephemeral collaboration state.

## Scope
- one-to-one direct conversations;
- DM navigation;
- DM real-time rooms;
- Redis-backed presence;
- multi-tab/multi-socket presence logic;
- typing indicators;
- timeout/debounce behavior.

## Definition of Done
Two workspace members can DM each other, see online state, and see typing activity with correct cleanup after disconnects.

---

# Sprint 6 — Interaction Layer

## Objective
Add the collaboration details expected from a modern messaging product.

## Scope
- reactions;
- reply UX refinement;
- read state;
- unread counts;
- unread separators;
- latest activity ordering;

## Definition of Done
Unread state remains consistent across navigation and refresh, and reaction/read updates propagate correctly.

---

# Sprint 7 — Files, Search & Reliability

## Objective
Complete practical communication workflows and harden synchronization.

## Scope
- attachment upload;
- server-local storage with a persistent production volume;
- attachment permissions;
- PostgreSQL message search;
- reconnect synchronization;
- missed message recovery;
- authorization revocation while connected;
- rate limiting;
- standardized socket/API errors.

## Definition of Done
Users can search and share files, and a temporarily disconnected client can recover missed durable messages without duplicates.

---

# Sprint 8 — Impeccable UI Refinement

## Objective
Push the complete Relay interface to portfolio-quality visual and interaction standards using Impeccable.

## Mandatory Tooling
**Impeccable** is the primary UI audit/refinement workflow for this sprint.

## Preconditions
Do not start this sprint until the major product flows are stable.

## Scope
- audit the complete app;
- improve visual hierarchy;
- improve typography;
- normalize spacing;
- improve sidebar density;
- refine message rows;
- refine composer;
- refine reactions/replies;
- improve loading, empty, error, and offline states;
- improve mobile/tablet behavior;
- improve hover/focus/active states;
- improve accessibility;
- reduce generic AI-generated styling patterns;
- preserve product functionality.

## Constraints
- No major backend rewrite.
- No feature expansion unless required to fix a UX blocker.
- Avoid decorative overdesign.
- Communication remains the visual focus.

## Definition of Done
The entire app feels cohesive, intentional, responsive, accessible, and production-ready rather than like separate screens built sprint-by-sprint.

---

# Sprint 9 — Testing, Seed Data & Deployment

## Objective
Finish Relay as a complete deployable portfolio product.

## Scope
- unit/integration cleanup;
- WebSocket multi-client tests;
- Playwright critical flows;
- permission matrix tests;
- reconnect tests;
- realistic seed data;
- demo workspace;
- Docker production setup;
- Coolify deployment;
- production PostgreSQL/Redis/storage configuration;
- smoke tests;
- README;
- portfolio screenshots/details.

## Definition of Done
Relay is publicly deployable, testable with multiple users, visually complete, and ready to demonstrate in interviews or portfolio reviews.
