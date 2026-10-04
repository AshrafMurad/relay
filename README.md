# Relay

Relay is a real-time communication workspace for small remote teams. The repository contains two independent applications and intentionally does not use npm workspaces or a shared package:

- `frontend/`: Next.js 16 and React 19
- `backend/`: Express 5, Socket.IO, Prisma, PostgreSQL, and Redis
- `docker/`: local infrastructure
- `docs/`: product and engineering specifications

## Prerequisites

- Node.js 24.x LTS with its bundled npm version
- Docker with Docker Compose

The repository includes `.nvmrc` and `.node-version`, and both applications enforce the Node 24 runtime line.

## Initial Setup

Install each application independently:

```powershell
npm --prefix frontend ci
npm --prefix backend ci
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env
```

The backend example secret is for local development only. Replace every production credential through the deployment secret manager.

## Infrastructure

Start PostgreSQL 18, Redis 8.2, and Mailpit:

```powershell
docker compose -f docker/compose.dev.yml up -d
```

Verify the services:

```powershell
docker compose -f docker/compose.dev.yml ps
```

Local service ports:

| Service | Address |
| --- | --- |
| Next.js | `http://localhost:3000` |
| Express and Socket.IO | `http://localhost:4000` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Mailpit SMTP | `localhost:1025` |
| Mailpit web interface | `http://localhost:8025` |

## Prisma

Validate the schema and generate Prisma Client after installing backend dependencies:

```powershell
npm --prefix backend run prisma:validate
npm --prefix backend run prisma:generate
```

Product tables and their migrations are introduced by the sprint that owns each domain. Sprint 0 verifies PostgreSQL through Prisma without creating placeholder product models.

## Development

Run each application in a separate terminal:

```powershell
npm --prefix backend run dev
```

```powershell
npm --prefix frontend run dev
```

Google OAuth is disabled during local development when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are empty. Supplying only one credential is invalid, and both are mandatory in production.

## Health Checks

| Check | URL | Behavior |
| --- | --- | --- |
| Web process | `http://localhost:3000/healthz` | Returns `200` when Next.js is serving requests |
| API process | `http://localhost:4000/api/health/live` | Returns `200` while the API process is alive |
| API dependencies | `http://localhost:4000/api/health/ready` | Returns `200` for healthy or Redis-degraded operation and `503` when PostgreSQL is unavailable |

Redis degradation is explicit in the readiness body. Durable PostgreSQL-backed operations remain available, while Redis-backed ephemeral features are unavailable.

## Validation

Run checks inside the application they belong to:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
$env:NEXT_PUBLIC_API_URL = "https://relay.example.com/api"
$env:NEXT_PUBLIC_SOCKET_URL = "https://relay.example.com"
npm --prefix frontend run build
```

Next.js production builds require the final HTTPS public origin. Local `next dev` continues to use the HTTP values from `frontend/.env.local`.

```powershell
npm --prefix backend run prisma:validate
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run test:integration
npm --prefix backend run build
```

The integration tests require the Docker PostgreSQL and Redis services to be running.

## Shutdown

Stop the applications with `Ctrl+C`, then stop the infrastructure:

```powershell
docker compose -f docker/compose.dev.yml down
```

Add `-v` only when intentionally deleting the local PostgreSQL data volume.
