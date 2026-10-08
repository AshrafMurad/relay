# Relay — Technical Architecture

## 1. Chosen Stack

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Zustand
- React Hook Form
- Zod

### Backend
- Express.js
- Socket.IO attached to the dedicated Node.js HTTP server
- REST APIs for non-real-time application operations

### Data
- PostgreSQL
- Prisma ORM
- Redis

### Authentication
- Email/password authentication hosted by Express and integrated with the shared user model.
- Email verification and Google OAuth are outside the current product scope.
- Opaque database-backed sessions in PostgreSQL, transported by an HttpOnly cookie.
- The Socket.IO handshake validates the same session cookie as HTTP requests.

### Storage
- Store attachments under the backend's configured upload directory.
- Mount that directory as a persistent volume in production.
- Store attachment metadata and generated storage keys in PostgreSQL, not file binaries.

### Testing
- Vitest
- React Testing Library
- Playwright
- Supertest for HTTP integration tests
- Socket.IO client test utilities for real-time integration tests

### Deployment
- Docker
- Coolify
- Reverse proxy / TLS through deployment platform

### UI Refinement
- Impeccable during the dedicated UI refinement phase.

## 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │       Browser       │
                    └─────────┬───────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
             HTTPS                       WebSocket
                │                           │
                v                           v
      ┌──────────────────┐       ┌──────────────────┐
      │     Next.js      │       │     Express      │
      │ Web / UI Layer   │       │ API + Realtime   │
      └────────┬─────────┘       └───────┬──────────┘
               │                         │
               └────────────┬────────────┘
                            v
                  ┌──────────────────┐
                  │   PostgreSQL     │
                  └──────────────────┘
                            ▲
                            │
                  ┌──────────────────┐
                  │      Redis       │
                  │ presence/pubsub  │
                  └──────────────────┘
```

## 3. Responsibility Split

### Next.js
Responsible for:

- rendering the web application;
- route handling;
- client UI;
- initial server-side data loading where useful;
- session-aware application entry;
- forms and frontend UX.

### Express API
Responsible for:

- domain APIs;
- workspace operations;
- channels;
- membership/invitations;
- messages;
- search endpoints;
- attachment metadata;
- authorization;
- Socket.IO server and event handlers;
- real-time event validation;
- connection lifecycle;
- presence orchestration;
- read/unread synchronization.

This keeps business logic centralized in the backend rather than split unpredictably between Next.js route handlers and Express.

## 4. Repository Layout

Use two independent applications in one repository. Each application owns its dependencies, lockfile, configuration, tests, and environment variables. Do not use npm workspaces or shared packages.

```text
relay/
├── frontend/         # Next.js application
├── backend/          # Express + Socket.IO application and Prisma schema
├── docker/
└── docs/
```

The backend owns canonical API DTOs, validation, and socket payload contracts. Keep frontend request/response types explicit and mirror or generate them only when required; do not import backend source into the frontend.

## 5. Supported Runtime Matrix

| Component | Supported line |
| --- | --- |
| Node.js | 24.x LTS |
| TypeScript | 5.9.x |
| Next.js | 16.3.x |
| React | 19.2.x |
| Express | 5.2.x |
| Socket.IO | 4.8.x |
| Prisma | 6.19.x |
| PostgreSQL | 18.x |
| Redis server | 8.2.x |
| Redis Node client | 6.3.x |

CI, local version files, and production images must target Node.js 24 rather than an unpinned current release.

## 6. API Style

Use HTTP for durable commands and query operations that do not require live delivery.

Examples:

- create workspace;
- invite member;
- create channel;
- load message history;
- search messages;
- update profile.

Use Socket.IO for events requiring immediate propagation.

Examples:

- new message;
- message update/delete;
- reaction changes;
- typing;
- presence;
- read-state updates where real-time propagation is useful.

## 7. Public Routing

Production uses a single browser-facing origin with proxy path routing:

```text
https://relay.example.com/             -> Next.js
https://relay.example.com/api/*        -> Express
https://relay.example.com/socket.io/*  -> Express / Socket.IO
```

Next.js and Express remain independent applications and deployment services. The shared public origin avoids cross-subdomain session cookies. Development runs Next.js at `http://localhost:3000` and Express at `http://localhost:4000` with credentialed CORS restricted to the exact web origin.

## 8. Environment Contract

Frontend:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Backend:

```dotenv
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_SECRET=
DATABASE_URL=postgresql://relay:relay@localhost:5432/relay
REDIS_URL=redis://localhost:6379
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=Relay <no-reply@relay.local>
UPLOAD_DIR=./storage/uploads
LOG_LEVEL=info
TRUST_PROXY=false
```

Both applications validate environment variables with Zod at startup. Product limits are typed application constants rather than deployment settings. See `16-SPRINT-0-DECISIONS.md` for validation and production-value rules.

## 9. Redis Responsibilities

Redis should support:

- presence state;
- socket/session lookup where useful;
- typing state if centralized handling is required;
- Socket.IO pub/sub adapter when running multiple API instances;
- application rate-limit state.

Do not treat Redis as the source of truth for messages.

## 10. Scaling Path

V1 may run one Express API/Socket.IO instance.

Future horizontal scaling path:

```text
Client
  ↓
Load Balancer
  ↓
Express + Socket.IO Instances
  ↕
Redis Socket.IO Adapter
  ↓
PostgreSQL
```

The architecture should permit this without requiring it on day one.

## 11. Engineering Principle

Express services and PostgreSQL own durable business behavior. Socket.IO transports real-time events. Redis coordinates ephemeral distributed state. Next.js owns presentation and browser experience.
