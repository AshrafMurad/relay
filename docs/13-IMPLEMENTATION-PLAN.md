# Relay — Implementation Plan

## 1. Implementation Philosophy

Build the product vertically from stable foundations to real-time behavior, then polish the UI after core workflows are working.

Do not start with high-fidelity UI polishing.

## 2. Stage 1 — Foundation

Deliver:

- independent `frontend` Next.js app;
- independent `backend` Express API app;
- explicit API and socket contracts without shared packages;
- PostgreSQL;
- Prisma;
- Redis;
- environment configuration;
- Docker development setup;
- base lint/typecheck/test commands.

## 3. Stage 2 — Authentication & Identity

Deliver:

- user model;
- authentication;
- protected frontend routes;
- authenticated Express endpoints;
- authenticated Socket.IO handshake proof-of-concept.

## 4. Stage 3 — Workspace Domain

Deliver:

- workspace CRUD;
- membership;
- roles;
- invitations;
- workspace switching/context;
- permission guards.

## 5. Stage 4 — Channels & Application Shell

Deliver:

- channel model;
- channel APIs;
- sidebar/navigation;
- channel creation;
- channel route;
- base message surface.

## 6. Stage 5 — Durable Messaging

Before real-time delivery, establish correct persistence.

Deliver:

- message model;
- idempotent HTTP message creation through the backend message service;
- message history endpoints;
- pagination;
- edit/delete;
- replies;
- basic composer;
- basic optimistic client model.

## 7. Stage 6 — Real-Time Messaging

Deliver:

- Socket.IO server and event handlers;
- authentication;
- rooms;
- send event;
- ack event;
- broadcast;
- optimistic reconciliation;
- failure state;
- deduplication.

The Socket.IO send handler must call the same message service established for HTTP creation rather than implementing a second persistence path.

## 8. Stage 7 — DMs

Deliver:

- direct conversations;
- DM member constraints;
- DM history;
- DM socket rooms;
- DM navigation;
- unread state.

## 9. Stage 8 — Presence & Typing

Deliver:

- Redis-backed presence;
- multi-socket handling;
- typing events;
- cleanup/grace logic;
- UI indicators.

## 10. Stage 9 — Reactions, Read State, Attachments, Search

Deliver:

- reactions;
- conversation read state;
- unread counts;
- attachment upload/storage integration;
- PostgreSQL search.

## 11. Stage 10 — Reliability

Deliver:

- reconnect synchronization;
- missed message recovery;
- authorization revocation behavior;
- rate limiting;
- improved error contracts;
- observability/logging.

## 12. Stage 11 — Impeccable UI Refinement

Once functionality is stable:

- run full UI audit using Impeccable;
- improve typography;
- improve spacing;
- refine conversation density;
- refine sidebar hierarchy;
- improve responsive behavior;
- improve empty/error/loading states;
- improve accessibility;
- preserve backend behavior.

## 13. Stage 12 — Demo & Production

Deliver:

- seed data;
- realistic demo workspace;
- Docker production config;
- Coolify deployment;
- storage configuration;
- production Redis/PostgreSQL;
- final test pass;
- README and portfolio presentation.
