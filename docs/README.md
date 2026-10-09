# Relay Documentation

Relay is a real-time communication workspace for small remote teams.

## Documentation Index

1. `01-PRODUCT-OVERVIEW.md` — product vision, audience, goals, non-goals.
2. `02-V1-SCOPE.md` — exact V1 boundaries.
3. `03-INFORMATION-ARCHITECTURE.md` — navigation and application structure.
4. `04-BUSINESS-RULES.md` — roles, messaging, presence, read state, permissions.
5. `05-DOMAIN-DATA-MODEL.md` — entities and relationships.
6. `06-TECHNICAL-ARCHITECTURE.md` — Next.js + Express + PostgreSQL + Prisma + Redis + Socket.IO architecture.
7. `07-REALTIME-SYSTEM-DESIGN.md` — connection, events, presence, reconnect, deduplication.
8. `08-API-AND-EVENT-CONTRACTS.md` — HTTP and Socket.IO contract conventions.
9. `09-UX-AND-DESIGN-SYSTEM.md` — UX direction and Impeccable UI policy.
10. `10-USER-FLOWS.md` — main end-to-end flows.
11. `11-SECURITY-AND-PERMISSIONS.md` — authorization and security model.
12. `12-TESTING-STRATEGY.md` — test priorities and scenarios.
13. `13-IMPLEMENTATION-PLAN.md` — recommended implementation order.
14. `14-SEED-AND-DEMO-DATA.md` — realistic portfolio demo content.
15. `15-DEPLOYMENT-AND-OPERATIONS.md` — Docker/Coolify production plan.
16. `RELAY-SPRINT-PHASES.md` — sprint-by-sprint execution plan, including dedicated Impeccable UI refinement.
17. `16-SPRINT-0-DECISIONS.md` — locked authentication, runtime, limits, pagination, timing, rate-limit, and deployment decisions.
18. `17-PREPRODUCTION-HARDENING.md` — preproduction implementation notes, validation evidence, and release follow-ups.

## Locked Architecture

- Next.js 16 / React 19 / TypeScript
- Express backend with Socket.IO
- Socket.IO
- PostgreSQL
- Prisma
- Redis
- Tailwind CSS v4
- shadcn/ui
- Zustand
- React Hook Form + Zod
- Server-local attachment storage on a persistent production volume
- Docker + Coolify
- Impeccable for dedicated UI refinement

## Decision Authority

`16-SPRINT-0-DECISIONS.md` records the concrete values chosen during Sprint 0. When an older document uses provisional language that conflicts with it, the Sprint 0 decision record is authoritative until the topic-specific document is reconciled.
