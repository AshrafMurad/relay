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

## Phase 2: Production Security Hardening

### Threats addressed

- Script injection and XSS amplification through a missing or weak Content-Security-Policy.
- Clickjacking via embedding, referrer leakage, and uncontrolled browser features.
- Cross-site request forgery against cookie sessions beyond `SameSite=Lax`.
- Upload memory exhaustion and spoofed file content on the attachment path.
- Disk exhaustion from orphaned multipart temporary files after interrupted or failed uploads.
- Private attachment caching by browsers or intermediaries.
- Account enumeration through sign-in timing and weak or silently drifting password hashing.
- Secret leakage through logs and seed output.
- Container privilege escalation and unbounded resource use in production.

### Controls implemented

- **Strict nonce-based CSP (`frontend/proxy.ts`, `frontend/lib/csp.ts`).** A per-request nonce with `'strict-dynamic'` is applied to `script-src`; `default-src 'self'`, `img-src`/`connect-src` restricted to the API/socket origin (plus DiceBear for seed avatars), `object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests` in production, and `unsafe-eval`/localhost sources in development only. The nonce is injected into request headers so Next.js attaches it to framework, bundle, and inline hydration scripts; the root layout passes it to the external theme bootstrap script and opts every page into the required dynamic rendering. A static config-level CSP was deliberately removed because multiple CSP headers intersect and would re-block hydration scripts.
- **Security headers (`frontend/next.config.ts`).** `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, locked-down `Permissions-Policy`, and production-only HSTS (`max-age=15552000; includeSubDomains`).
- **External theme bootstrap (`frontend/public/theme-init.js`).** The inline init script was replaced with a nonce-carrying external file, eliminating inline script content while preserving the no-flash theme behavior.
- **Origin guard (`backend/src/middleware/origin-guard.ts`).** Unsafe HTTP methods must present a matching `Origin`, trusted `Sec-Fetch-Site`, or matching `Referer`; provably cross-origin browser requests get `403 FORBIDDEN`. Safe methods and non-browser clients without origin evidence pass. Defense in depth behind `SameSite=Lax`; wired in `backend/src/app.ts` after cookie parsing.
- **Disk-backed uploads (`backend/src/modules/attachments/attachment.routes.ts`).** Multipart bodies stream to `UPLOAD_DIR/tmp` as `<uuid>.uploading` files instead of process memory, keeping the 25 MiB per-file bound while removing the memory-amplification vector.
- **Bounded content validation (`attachment.service.ts`).** Binary types read a 64 KiB signature window; textual types are fully read only because they are bounded by the same file-size limit and validated as strict UTF-8 without null bytes (JSON also parsed).
- **Total temp-file cleanup.** Validation, extension, authorization, quota, and rename/persistence failures all remove the streamed temporary file and roll back the pending attachment row; `sweepStaleTempUploads` removes files older than one hour at startup and hourly alongside expired-pending cleanup (`backend/src/server.ts`).
- **No caching of private downloads.** Authorized attachment downloads send `Cache-Control: no-store`.
- **Sign-in hardening (`backend/src/modules/auth/auth.service.ts`).** scrypt parameters are pinned and auditable (N=16384, r=8, p=1, 64-byte key, 64 MiB maxmem); unknown accounts perform an equivalent dummy derivation so response timing does not reveal account existence, and both failure branches return the identical `INVALID_CREDENTIALS` envelope.
- **Log and seed hygiene.** The redactor covers `accessToken`/`refreshToken`/`idToken`/`sessionToken` key patterns in addition to the existing set; the seed reads an optional `DEMO_PASSWORD` and never prints the demo password.
- **Container hardening.** Backend and frontend runtime images run as the non-root `node` user; the production Compose file adds `read_only` root filesystems with a writable `/tmp` tmpfs, `cap_drop: ALL`, `no-new-privileges`, `init`, and memory/CPU limits for api and web, and `no-new-privileges` for postgres/redis. The upload volume remains writable at `/app/storage/uploads`. The frontend image build skips Playwright browser downloads (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`) because the runtime image never executes browser tests.
- **Regression coverage.** Playwright asserts the CSP, frame, referrer, and nosniff headers on the production server; the e2e launcher serves the production build.

### Issues found and fixed during the Phase 2 review

- The static production CSP would have blocked Next.js inline hydration scripts, breaking all client interactivity; replaced with the proxy nonce scheme above and pinned by Playwright interactivity assertions.
- A temp-file leak: extension/size/path validation threw before the cleanup `try` block, orphaning the streamed upload until the hourly sweep. All validation now occurs inside the guarded block.
- A rejected startup scrypt derivation could surface as an unhandled process rejection; the dummy verification target now has a fail-closed fallback.

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

### Phase 2 validation record (October 9, 2026, continued)

- Backend: lint, typecheck, build, and `prisma:generate` passed. Unit tests grew to 72 (origin guard, stale-temp sweeping, temp-file cleanup on validation/authorization/quota/persistence failure, scrypt compatibility with pre-pinning hashes, identical unknown-account/wrong-password envelopes); 51 integration tests passed against live PostgreSQL and Redis, including assertions that the multipart temp directory is empty after rejected and successful uploads and `Cache-Control: no-store` on downloads. The earlier `prisma:generate` `EPERM` blocker is resolved: the backend dev server must be stopped first, then generation succeeds.
- Frontend: lint, typecheck, 48 unit/component tests, and the production build passed. The build emits dynamic routes with the registered proxy; a served-page probe confirmed the CSP header carries the per-request nonce and that all script tags — including inline hydration scripts and the theme bootstrap — carry it. Playwright passed 7 tests with 1 intentional mobile skip, including theme toggling/persistence under the strict policy and extended header assertions (`script-src 'self' 'nonce-`, `'strict-dynamic'`).
- Dependency audits re-run: backend full and production-only clean; frontend production-only clean; frontend full still the known 9 development-only `braces` findings.
- Production images: the api image builds cleanly with the non-root runtime user. The web image build was not run to completion in this session (its `npm ci` was dominated by Playwright browser downloads before the skip flag was added); bringing the full production stack up and exercising non-root/read-only/writable-volume behavior remains a pre-release rehearsal step.

## Follow-ups

- Resolve the remaining frontend development-tooling advisory with a compatible upstream patch or tested replacement.
- Complete security hardening, performance measurement, architecture/code splitting, CI/critical-flow E2E, backups, monitoring, and deployment rehearsal in subsequent phases.
- Verify slow uploads and long-lived Socket.IO connections through the real Coolify/Traefik HTTPS origin before release.

## Phase 2 residual risks and operational requirements

- The nonce CSP requires every page to render dynamically; static optimization and CDN caching of HTML are intentionally traded away for V1. Static assets under `_next/static` remain cacheable.
- `upgrade-insecure-requests` and HSTS assume HTTPS termination at the deployment proxy; deploying without TLS would break mixed-content behavior, so the Coolify/Traefik origin must be verified before release.
- The production web image still needs a full build-and-run rehearsal (non-root user, read-only root filesystem, health check) alongside the api container; the api image builds and its hardening options are configured.
- The `braces` advisory remains open in development tooling only; re-check the audit after any dependency update.
- The origin guard deliberately passes non-browser clients without origin evidence; machine-to-machine callers are out of the V1 CSRF threat model and must be re-evaluated if API tokens are introduced.
- Attachment uploads rely on the hourly stale-temp sweep as the last line of defense; keep the cleanup interval under review if upload volume grows.
