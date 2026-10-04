# Relay Agent Context

## Status

Relay is specification-first and is entering Sprint 0. The repository has two independent applications, not a monorepo and not an npm workspace:

- `frontend/`: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui.
- `backend/`: Express, Socket.IO, Prisma/PostgreSQL, and Redis.
- `docker/`: local and production infrastructure.
- `docs/`: product, architecture, security, testing, and delivery specifications.

Each application owns its `package.json`, lockfile, TypeScript configuration, lint configuration, tests, and environment file. Do not introduce root workspaces or shared packages. Keep API DTOs and socket payloads explicit; generate or mirror frontend types only when needed.

## Product

Relay is a real-time communication workspace for small remote teams. V1 includes authentication, workspaces, public channels, one-to-one DMs, messages, replies, reactions, presence, typing, read state, attachments, and PostgreSQL search. Reliability, authorization, reconnect recovery, and deduplication outrank feature breadth and visual polish.

## Read First

Start with `docs/README.md` and `docs/RELAY-SPRINT-PHASES.md`. Read only the documents relevant to the current sprint, then inspect existing code before editing. Treat implemented tests and contracts as authoritative; security and product-scope rules must not be weakened without explicit approval.

## Architecture

- Next.js owns routes, rendering, forms, browser state, and user experience.
- Express owns domain behavior, REST APIs, authorization, and Socket.IO handlers.
- PostgreSQL is the source of truth for durable state and reconnect recovery.
- Redis coordinates ephemeral presence, typing, rate limits, and future Socket.IO pub/sub. It is not a message store.
- Socket.IO transports immediate events; it does not replace persistence.
- The backend filesystem holds attachment binaries under `backend/storage/uploads`; PostgreSQL holds metadata and generated storage keys.
- Use HTTP for durable queries and ordinary commands. Use Socket.IO where immediate propagation matters.

## Non-Negotiable Rules

- Authenticate HTTP requests and the Socket.IO handshake.
- Authorize every resource operation and incoming socket event server-side.
- Never trust client-supplied user, workspace, channel, or conversation IDs.
- Socket-room membership is not proof of authorization.
- Scope every query to workspace or conversation membership.
- Validate external input with Zod and return stable machine-readable error codes.
- Keep database models internal; expose deliberate DTOs.
- Use `domain:action` socket event names.
- Use client operation IDs for idempotent sends and optimistic reconciliation.
- Use server IDs and timestamps as canonical message order.
- Recover missed durable events from PostgreSQL after reconnect.
- Presence and typing are ephemeral; messages, reactions, and read state are durable.
- Render V1 messages as safe plain text.
- Validate uploads server-side, prevent path traversal, and serve private files only after authorization.
- Keep production uploads on a persistent mounted volume and include them in backups.
- Never log secrets, tokens, cookies, credential-bearing URLs, or unnecessary message content.

## Workflow

Follow `docs/RELAY-SPRINT-PHASES.md`: foundation, identity/workspaces, shell/channels, durable messaging, realtime messaging, DMs/presence/typing, interactions, files/search/reliability, UI refinement, then production. Build persistence before realtime propagation. Do not expand V1 or begin final visual polish without explicit approval.

## Validation

Run commands inside the application they belong to. Before declaring work complete, run that application's lint, typecheck, and relevant tests. Realtime behavior requires at least two independent clients. Prioritize authorization isolation, retries/deduplication, reconnect recovery, multi-tab presence, unread consistency, and connected-user revocation.

Exact scripts are established during Sprint 0. Never invent or report unverified commands; read the relevant `package.json` first.

## Open Sprint 0 Decisions

Confirm authentication integration, environment variable names, archive behavior, upload/message limits, pagination, timeouts, rate limits, and supported runtime/database versions before depending on them.
