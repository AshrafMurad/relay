# Relay — Deployment & Operations

## 1. Deployment Target

Deploy with Docker through Coolify on a VPS.

## 2. Services

Production stack:

```text
Next.js Web
Express API / Socket.IO
PostgreSQL
Redis
Persistent Attachment Volume
```

## 3. Domains

Required V1 structure:

```text
relay.example.com/             -> Next.js
relay.example.com/api/*        -> Express HTTP
relay.example.com/socket.io/*  -> Express Socket.IO
```

A single public origin with reverse-proxy path routing is required for V1. Next.js and Express remain separate services internally, but first-party routing avoids cross-subdomain session cookies.

## 4. Required Environment Categories

### Web
- public API base URL;
- public socket URL;

### API
- database URL;
- Redis URL;
- auth/session secrets;
- allowed web origin;
- attachment storage path.

Exact variable names and development examples are defined in `16-SPRINT-0-DECISIONS.md`. Environment values are validated with Zod at process startup, and secrets never use a `NEXT_PUBLIC_` prefix.

## 5. Runtime Baseline

Production and CI use:

- Node.js 24.x LTS;
- TypeScript 5.9.x;
- Prisma 6.19.x;
- PostgreSQL 18.x;
- Redis 8.2.x.

Use the latest compatible patch release within each selected line.

## 6. WebSocket Proxy Requirements

Reverse proxy must support WebSocket upgrade headers and long-lived connections.

Coolify/Traefik should be configured accordingly.

## 7. PostgreSQL

- use persistent volume/managed DB;
- run Prisma migrations during deployment through a controlled release step;
- perform backups.

## 8. Redis

Redis is operationally important for presence and eventual multi-instance Socket.IO pub/sub.

Configure persistence based on actual requirements, but remember durable messages live in PostgreSQL.

If Redis is unavailable, readiness is degraded, presence is reported as unavailable, typing is disabled, and the single API instance enforces the same numeric rate limits with in-process counters. Durable PostgreSQL operations remain available; in-process counters are explicitly not a multi-instance substitute.

## 9. Attachment Storage

Production attachments are stored on the Express server's filesystem under a configured upload directory backed by a persistent Docker volume.

Store only file metadata and generated storage keys in PostgreSQL. Do not place uploads in a publicly served directory; return files through an endpoint that verifies access to the associated message or conversation.

The default limits are 25 MiB per file, 5 files and 50 MiB per message, and 5 GiB per workspace. Pending files not attached to a message expire after 24 hours.

## 10. Health Checks

Expose health/readiness checks for:

- API process;
- PostgreSQL connectivity;
- Redis connectivity where appropriate.

## 11. Logging

Log:

- API errors;
- socket connection errors;
- unexpected disconnect trends;
- authorization failures;
- failed background/storage operations.

Do not log secrets or message content unnecessarily.

## 12. Deployment Order

1. Provision PostgreSQL.
2. Provision Redis.
3. Provision and mount the persistent attachment volume.
4. Deploy Express API / Socket.IO service.
5. Run migrations.
6. Deploy Next.js.
7. Verify WebSocket connection.
8. Run production smoke test with two users.

## 13. Backup Priorities

Back up:

- PostgreSQL database;
- the persistent attachment volume.

Redis presence state does not need to be treated as the canonical backup source.
