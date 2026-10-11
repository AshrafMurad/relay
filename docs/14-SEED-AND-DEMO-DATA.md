# Relay — Seed & Demo Data Strategy

## 1. Goal

The seed should make Relay look like a real product in active use rather than an empty technical demo.

## 2. Demo Workspace

Suggested fictional company:

**Northstar Labs** — a small remote product studio.

## 3. Demo Members

Create a realistic team with different roles:

- Owner / Founder
- Admin / Engineering Lead
- Product Manager
- Frontend Developer
- Backend Developer
- Product Designer
- QA Engineer
- Customer Support

Use fictional names and avatars/placeholders.

The implemented demo uses `owner@example.com`, `admin@example.com`, and `user@example.com` through `user6@example.com`. See the README's **Seeded Test Accounts** table for names and roles. All accounts use `DEMO_PASSWORD` when provided, otherwise `123456`.

Run `npm run seed` inside `backend/`, or inside Coolify's API container after deploying the updated image and applying migrations. Node.js 24 runs `prisma/seed.ts` directly; development-only executables are not required. The seed loads `.env` locally and respects the container's runtime environment, using the same PostgreSQL adapter as the API.

Each rerun recreates the demo workspace/content, updates the demo credentials with a fresh salt and the API's pinned scrypt parameters, removes their previous demo-email credential rows, and revokes existing demo sessions. Stable user IDs allow existing seeded users to be renamed rather than duplicated. An independently created user or credential with a reserved demo email causes the seed to stop before rebuilding the workspace.

## 4. Channels

Suggested channels:

```text
#general
#product
#engineering
#design
#support
#random
```

## 5. Conversation Scenarios

Seed conversations should include:

- project update discussion;
- bug report discussion;
- design feedback;
- deployment coordination;
- support escalation;
- casual team conversation.

## 6. Data Variety

Include:

- short messages;
- multiline messages;
- replies;
- edited messages;
- reactions;
- messages with attachments;
- unread conversations;
- read conversations;
- different timestamps;
- active/inactive members.

## 7. Presence Demo

Presence itself is ephemeral, but demo/dev tooling may simulate or simplify multiple active users where necessary for screenshots/testing.

## 8. Seed Scale

Enough data should exist to exercise:

- pagination;
- search;
- unread counts;
- recent DM ordering;
- message density.

A practical target is hundreds of messages across channels rather than thousands unless performance testing needs more.

## 9. Demo Quality Rule

Avoid repetitive lorem ipsum. Seed content should read like realistic workplace communication.
