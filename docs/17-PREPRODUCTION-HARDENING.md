# Relay — Preproduction Hardening

## Phase 1: Release Blockers

### Shared rate limiting

- `backend/src/lib/rate-limiter.ts` owns one limiter per API instance, injected into both Express and Socket.IO.
- Redis uses an atomic rolling-window Lua script with server time, unique admission IDs, and expiring keys.
- Message and reaction budgets are shared across HTTP and socket transports. Other limits preserve the Sprint 0 scopes and numeric values.
- Keys hash their scope and identity; normalized emails and IP addresses are not stored in plaintext key names.
- Redis commands do not queue while disconnected and have a one-second command timeout.
- The single-instance fallback retains recent local admissions across Redis failure/recovery, periodically expires old identities, and bounds its map to 50,000 entries. When that bound is reached, unfamiliar identities are rejected until entries expire.
- HTTP rejection includes the stable error code and `Retry-After`. Readiness reports degradation when Redis rate-limit operations fail.
- The fallback is not a replacement for coordinated limits in a multi-instance deployment; V1 still deploys one API instance.

### Realtime/test reliability

- Multi-tab presence tests await the offline event after the documented 15-second grace, including asynchronous persistence and delivery time.
- Typing cleanup runs during `disconnecting`, while conversation rooms still exist.
- Presence publication rechecks local reconnects after asynchronous membership lookup. Server closure clears pending presence/typing timers.
- Redis startup setup completes subscriptions even when initial connection establishment exceeds the startup wait, so delayed recovery does not leave an unconfigured client.
- Playwright tests exercise theme controls through the account menu and close mobile navigation before inspecting the message pane. Sync fixtures return a real response envelope and unexpected fixture paths return 404.
- The default Playwright server uses a fresh production build on port 3100 rather than reusing a developer's server. Its launcher serves the same standalone artifact and copied public/static asset layout as the Docker runner.

### Upload deadlines

- Browser JSON requests retain a 15-second deadline; multipart uploads have a 60-second deadline.
- Browser deadlines include response-body parsing and preserve caller cancellation.
- Node's server-wide request receive deadline is 60 seconds; middleware narrows ordinary request-body receipt to 15 seconds. Only multipart POSTs to the attachment/profile/workspace image endpoints receive the extended allowance.
- An ordinary body timeout returns `408` with `REQUEST_TIMEOUT` and closes the incomplete request. Header receipt remains limited to 16 seconds.
- Deployment proxy requirements are recorded in `15-DEPLOYMENT-AND-OPERATIONS.md`; the deployed proxy must be tested separately.

### Dependency changes

- Prisma remains on the locked 6.19.x line. A scoped `@prisma/config` override selects `deepmerge-ts` 8.0.2 to address GHSA-ggr8-5vv4-36mx.
- Both applications use Vitest 4.1.11 or a compatible patched release, removing the affected Vitest mocker and Tinypool dependency paths.
- The frontend Vitest configuration uses `.mts` to make its ESM format explicit.
- The backend full dependency audit and both production-only dependency audits reported zero vulnerabilities on October 9, 2026.
- The frontend full audit still reports nine high-severity development-tooling entries rooted in `braces` GHSA-vfj7-8cjw-p6xm, through Next.js lint tooling and the shadcn CLI. The latest published `braces` release is 3.0.3 and is affected. Track an upstream patch or a tested tooling replacement; forced Next.js/shadcn downgrades are not a compatible fix. This dependency is absent from the production-only audit.

## Validation

Use Node.js 24 with the application's own package scripts. PostgreSQL and Redis must be healthy before running integration tests:

```powershell
docker compose -f docker/compose.dev.yml up -d --wait postgres redis
docker compose -f docker/compose.dev.yml ps
docker compose -f docker/compose.dev.yml exec -T redis redis-cli ping
```

The new meaningful regression checks cover:

- concurrent rate-limit admission across independent Redis connections/API instances;
- shared HTTP/socket message budgets;
- expiry, Redis failure, and Redis recovery without resetting the local allowance;
- HTTP `Retry-After` and identity/scope isolation;
- slow upload receipt versus ordinary body timeout;
- browser multipart deadline and response-body timeout;
- multi-client messaging, retries, DM isolation, presence, and connected-member removal through the existing integration suite.

Release validation also includes lint, typecheck, unit tests, integration tests, production builds, Prisma schema validation/client generation/migration deployment, Playwright, dependency audits, and production Compose configuration validation.

### October 9, 2026 validation record

- Both applications: lint and typecheck passed under Node.js 24.
- Backend: 56 unit tests and 51 integration tests passed, including independent socket clients and real Redis connections.
- Frontend: 48 unit/component tests passed; standalone-production Playwright passed seven tests, with one desktop-only case intentionally skipped on mobile.
- Both production builds passed. Prisma schema validation and migration deployment passed, with no pending migrations.
- Production Compose configuration validated against the placeholder example environment.
- Prisma Client generation remains blocked locally by `EPERM` replacing the Windows query-engine DLL while the backend dev server has it loaded. Stop that server and rerun `npm run prisma:generate` before signing off this check.

## Follow-ups

- Resolve the remaining frontend development-tooling advisory with a compatible upstream patch or tested replacement.
- Complete security hardening, performance measurement, architecture/code splitting, CI/critical-flow E2E, backups, monitoring, and deployment rehearsal in subsequent phases.
- Verify slow uploads and long-lived Socket.IO connections through the real Coolify/Traefik HTTPS origin before release.
