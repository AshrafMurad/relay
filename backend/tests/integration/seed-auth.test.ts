import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { parseEnvironment } from "../../src/config/env.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";

const execute = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const demoPassword = "123456";
const workspaceId = "58d22ca3-1f35-4702-8642-9222f5f34bc0";
const ownerId = "e23ac614-dbb6-4246-ab99-ff81a78a6d12";
const outsiderId = randomUUID();
const collisionId = randomUUID();
const emails = ["owner@example.com", "admin@example.com", "user@example.com", "user2@example.com", "user3@example.com", "user4@example.com", "user5@example.com", "user6@example.com"];
let uploadDir = "";
let userIds: string[] = [];
let app: ReturnType<typeof createApp>;

async function runSeed(password?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl, UPLOAD_DIR: uploadDir, DOTENV_CONFIG_PATH: path.join(uploadDir, "absent.env") };
  delete env.DEMO_PASSWORD;
  if (password !== undefined) env.DEMO_PASSWORD = password;
  return execute(process.execPath, ["prisma/seed.ts"], { cwd: process.cwd(), env, timeout: 30_000 });
}

beforeAll(async () => {
  await database.connect();
  uploadDir = await mkdtemp(path.join(os.tmpdir(), "relay-seed-auth-"));
  const environment = parseEnvironment({
    NODE_ENV: "test", WEB_ORIGIN: "http://localhost:3000", BETTER_AUTH_URL: "http://localhost:4000",
    BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-32-characters", DATABASE_URL: databaseUrl,
    REDIS_URL: "redis://localhost:6379", SMTP_HOST: "localhost", SMTP_PORT: "1025", SMTP_SECURE: "false",
    EMAIL_FROM: "Relay <no-reply@relay.test>", TRUST_PROXY: "false", LOG_LEVEL: "fatal", UPLOAD_DIR: uploadDir,
  });
  app = createApp(environment, { database, redis: { probe: async () => true } }, createLogger(environment));
  await database.prisma.user.create({ data: { id: outsiderId, email: `seed-outsider-${outsiderId}@relay.test`, name: "Independent User" } });
  // Simulate the legacy seed so the CLI must rename the same user and replace
  // stale credentials rather than merely creating a second set of accounts.
  await database.prisma.user.create({ data: { id: ownerId, email: "maya.owner@northstar.example", name: "Maya Chen" } });
  await database.prisma.account.create({ data: { userId: ownerId, providerId: "credential", accountId: "maya.owner@northstar.example", password: "obsolete-seed-hash" } });
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: workspaceId } });
  await database.prisma.user.deleteMany({ where: { id: { in: [...userIds, ownerId, outsiderId, collisionId] } } });
  await database.disconnect();
  if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
});

describe("production-compatible demo seed", () => {
  it("runs directly under Node, upgrades legacy accounts, and signs in all eight users", async () => {
    const output = await runSeed();
    expect(output.stdout).toContain("Seeded Northstar Labs");
    expect(output.stdout).not.toContain(demoPassword);
    const seeded = await database.prisma.user.findMany({ where: { email: { in: emails } } });
    userIds = seeded.map((user) => user.id);
    expect(seeded).toHaveLength(8);
    expect(seeded.find((user) => user.email === "owner@example.com")!.id).toBe(ownerId);
    expect(await database.prisma.account.count({ where: { accountId: "maya.owner@northstar.example", providerId: "credential" } })).toBe(0);
    expect(await database.prisma.user.count({ where: { id: outsiderId } })).toBe(1);
    for (const email of emails) {
      const response = await request(app).post("/api/auth/signin").send({ email, password: demoPassword }).expect(200);
      expect(response.body.user.email).toBe(email);
      expect(response.headers["set-cookie"][0]).toContain("relay_session=");
    }
    const members = await database.prisma.workspaceMember.findMany({ where: { workspaceId }, include: { user: true } });
    expect(members.find((member) => member.user.email === "owner@example.com")!.role).toBe("OWNER");
    expect(members.find((member) => member.user.email === "admin@example.com")!.role).toBe("ADMIN");
    expect(members.find((member) => member.user.email === "user@example.com")!.role).toBe("MEMBER");
  });

  it("updates passwords on rerun without duplicating accounts or retaining old sessions", async () => {
    const replacement = "DifferentDemoPass456!";
    expect(await database.prisma.session.count({ where: { userId: { in: userIds } } })).toBe(8);
    const output = await runSeed(replacement);
    expect(output.stdout).not.toContain(replacement);
    expect(await database.prisma.session.count({ where: { userId: { in: userIds } } })).toBe(0);
    expect(await database.prisma.account.count({ where: { userId: { in: userIds }, providerId: "credential" } })).toBe(8);
    await request(app).post("/api/auth/signin").send({ email: "admin@example.com", password: demoPassword }).expect(401);
    await request(app).post("/api/auth/signin").send({ email: "admin@example.com", password: replacement }).expect(200);
    expect(await database.prisma.workspace.count({ where: { id: workspaceId } })).toBe(1);
  });

  it("rejects invalid seed passwords before rebuilding demo data", async () => {
    const count = await database.prisma.message.count({ where: { workspaceId } });
    await expect(runSeed("short")).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("DEMO_PASSWORD must contain") });
    expect(await database.prisma.message.count({ where: { workspaceId } })).toBe(count);
  });

  it("does not overwrite an independently created user with a reserved demo email", async () => {
    const count = await database.prisma.message.count({ where: { workspaceId } });
    await database.prisma.user.update({ where: { id: ownerId }, data: { email: `renamed-${randomUUID()}@relay.test` } });
    await database.prisma.user.create({ data: { id: collisionId, email: "owner@example.com", name: "Independent Owner" } });
    await expect(runSeed()).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("belongs to a non-demo user") });
    expect(await database.prisma.user.findUniqueOrThrow({ where: { id: collisionId } })).toMatchObject({ name: "Independent Owner", email: "owner@example.com" });
    expect(await database.prisma.message.count({ where: { workspaceId } })).toBe(count);
  });
});
