# Relay

Relay is a real-time communication workspace for small remote teams. The repository contains two independent applications and intentionally does not use npm workspaces or a shared package:

- `frontend/`: Next.js 16 and React 19
- `backend/`: Express 5, Socket.IO, Prisma, PostgreSQL, and Redis
- `docker/`: local and production infrastructure
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

Apply migrations before running the backend against a fresh database:

```powershell
npm --prefix backend run prisma:migrate:deploy
```

Seed a demo workspace for screenshots, interviews, and smoke testing:

```powershell
npm --prefix backend run seed
```

The seed creates the Northstar Labs workspace with channels, DMs, replies, reactions, read state, and a small text attachment. All demo users use `RelayDemoPass123!` as the password.

## Development

Run each application in a separate terminal:

```powershell
npm --prefix backend run dev
```

```powershell
npm --prefix frontend run dev
```

Google OAuth is not part of the current product scope. The interface keeps a non-operational Google control labeled as coming soon.

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
npm --prefix frontend run test:e2e
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

The default Playwright run builds production code and starts a fresh test server on port `3100`. Its public API/socket origin is a synthetic HTTPS origin used by the mocked shell tests. Set `PLAYWRIGHT_BASE_URL` to run against an already deployed test environment instead. The current shell tests use mocked APIs; they do not replace the two-user production smoke test.

On Windows, stop the backend dev server before `prisma:generate` or dependency installation so its loaded Prisma engine DLL can be replaced. Validation uses Node.js 24; check `node --version` before running these commands.

Phase 1 hardening details and remaining dependency follow-ups are recorded in [docs/17-PREPRODUCTION-HARDENING.md](docs/17-PREPRODUCTION-HARDENING.md).

## Production Deployment

Production uses one public origin with reverse-proxy path routing:

| Public path | Service |
| --- | --- |
| `/` | Next.js web |
| `/api/*` | Express API |
| `/socket.io/*` | Express Socket.IO |

Use `docker/.env.production.example` as the Coolify environment checklist. Replace every placeholder secret in Coolify, keep `NEXT_PUBLIC_*` values public-origin only, and mount `relay-uploads` as a persistent volume for backend attachments.

Build and run the production stack locally for a deployment smoke check:

```powershell
Copy-Item docker/.env.production.example docker/.env.production
# edit docker/.env.production first
docker compose --env-file docker/.env.production -f docker/compose.prod.yml up --build
```

Run the controlled release step after the API image is deployed and before opening traffic to the web service:

```powershell
docker compose --env-file docker/.env.production -f docker/compose.prod.yml run --rm api npm run prisma:migrate:deploy
```

Smoke test production with two independent browser sessions/users:

1. Open `/healthz` and `/api/health/ready` and confirm healthy responses.
2. Sign in as two different demo users or two freshly created users.
3. Open the same channel, send a message from one browser, and confirm the other receives it live.
4. Disable/reconnect one browser network and confirm missed messages sync without duplicates.
5. Upload and download a small allowed attachment to confirm the persistent upload volume is mounted.

## Shutdown

Stop the applications with `Ctrl+C`, then stop the infrastructure:

```powershell
docker compose -f docker/compose.dev.yml down
```

Add `-v` only when intentionally deleting the local PostgreSQL data volume.
