import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import { io as createClient, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import type { ClientToServerEvents, MessageAckEvent, ServerToClientEvents } from "../../src/contracts/socket.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { createSocketServer } from "../../src/realtime/socket-server.js";
import { RealtimeEventBus } from "../../src/realtime/realtime-events.js";
import { createChannel } from "../../src/modules/channels/channel.service.js";
import { findOrCreateDirectConversation } from "../../src/modules/direct-conversations/direct-conversation.service.js";
import { createWorkspace } from "../../src/modules/workspaces/workspace.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const environment: Pick<Environment, "WEB_ORIGIN"> = { WEB_ORIGIN: "http://localhost:3000" };
const applicationEnvironment: Environment = {
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGIN: environment.WEB_ORIGIN,
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "test-only-secret-that-is-at-least-32-characters",
  DATABASE_URL: databaseUrl,
  REDIS_URL: "redis://localhost:6379",
  SMTP_HOST: "localhost",
  SMTP_PORT: 1025,
  SMTP_SECURE: false,
  EMAIL_FROM: "Relay <no-reply@relay.local>",
  UPLOAD_DIR: "./storage/uploads",
  LOG_LEVEL: "fatal",
  TRUST_PROXY: false,
};
const userIds = [randomUUID(), randomUUID(), randomUUID()];
const tokens = [randomUUID(), randomUUID(), randomUUID()];
const workspaceIds: string[] = [];
let workspaceId = "";
let channelId = "";
let directConversationId = "";

function cookie(index: number) {
  return `relay_session=${tokens[index]}`;
}

async function listen(withHttpApi = false) {
  const logger = createLogger({ LOG_LEVEL: "fatal" });
  const realtime = new RealtimeEventBus();
  const httpServer = withHttpApi
    ? createServer(createApp(applicationEnvironment, { database, redis: { probe: async () => false }, realtime }, logger))
    : createServer();
  const io = createSocketServer(httpServer, environment, logger, database.prisma, realtime);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port");
  return { httpServer, io, url: `http://127.0.0.1:${address.port}` };
}

async function close(httpServer: HttpServer, io: ReturnType<typeof createSocketServer>) {
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
}

async function connect(url: string, index: number) {
  const client: Socket<ServerToClientEvents, ClientToServerEvents> = createClient(url, {
    extraHeaders: { Origin: environment.WEB_ORIGIN, Cookie: cookie(index) },
  });
  await new Promise<void>((resolve, reject) => {
    client.once("connect", () => resolve());
    client.once("connect_error", reject);
  });
  return client;
}

async function join(client: Socket<ServerToClientEvents, ClientToServerEvents>, id = channelId) {
  return new Promise<{ ok: true } | { code: string; message: string }>((resolve) => {
    client.emit("conversation:join", { workspaceId, conversation: { type: "channel", id } }, resolve);
  });
}

async function joinDm(client: Socket<ServerToClientEvents, ClientToServerEvents>, id = directConversationId) {
  return new Promise<{ ok: true } | { code: string; message: string }>((resolve) => {
    client.emit("conversation:join", { workspaceId, conversation: { type: "dm", id } }, resolve);
  });
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({ id, email: `socket-message-${id}@relay.test`, name: `Socket User ${index + 1}`, emailVerified: true })),
  });
  await database.prisma.session.createMany({
    data: tokens.map((token, index) => ({
      userId: userIds[index]!,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    })),
  });
  const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `Socket Messages ${randomUUID()}` });
  workspaceId = workspace.id;
  workspaceIds.push(workspace.id);
  await database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "MEMBER" } });
  channelId = (await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `socket-${randomUUID().slice(0, 8)}` })).id;
  directConversationId = (await findOrCreateDirectConversation(database.prisma, workspaceId, userIds[0]!, userIds[1]!)).id;
  const outside = await createWorkspace(database.prisma, userIds[2]!, { name: `Socket Outside ${randomUUID()}` });
  workspaceIds.push(outside.id);
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

describe("real-time channel messaging", () => {
  it("acks the sender and broadcasts a canonical message to another channel member", async () => {
    const { httpServer, io, url } = await listen();
    const sender = await connect(url, 0);
    const receiver = await connect(url, 1);
    try {
      await expect(join(sender)).resolves.toEqual({ ok: true });
      await expect(join(receiver)).resolves.toEqual({ ok: true });
      const operationId = randomUUID();
      const received = new Promise<unknown>((resolve) => receiver.once("message:new", resolve));
      const acked = new Promise<unknown>((resolve) => sender.once("message:ack", resolve));
      sender.emit("message:send", { operationId, workspaceId, conversation: { type: "channel", id: channelId }, content: "hello live" });
      await expect(acked).resolves.toMatchObject({ operationId, message: { workspaceId, channelId, operationId, content: "hello live" } });
      await expect(received).resolves.toMatchObject({ message: { workspaceId, channelId, operationId, content: "hello live" } });
    } finally {
      sender.close();
      receiver.close();
      await close(httpServer, io);
    }
  });

  it("deduplicates retried operation IDs without rebroadcasting duplicate messages", async () => {
    const { httpServer, io, url } = await listen();
    const sender = await connect(url, 0);
    const receiver = await connect(url, 1);
    try {
      await join(sender);
      await join(receiver);
      const operationId = randomUUID();
      const broadcasts: string[] = [];
      receiver.on("message:new", (event) => broadcasts.push(event.message.id));
      sender.emit("message:send", { operationId, workspaceId, conversation: { type: "channel", id: channelId }, content: "retry me" });
      const firstAck = await new Promise<MessageAckEvent>((resolve) => sender.once("message:ack", resolve));
      sender.emit("message:send", { operationId, workspaceId, conversation: { type: "channel", id: channelId }, content: "changed retry" });
      const secondAck = await new Promise<typeof firstAck>((resolve) => sender.once("message:ack", resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(secondAck.message.id).toBe(firstAck.message.id);
      expect(secondAck.message.content).toBe("retry me");
      expect(broadcasts).toEqual([firstAck.message.id]);
      expect(await database.prisma.message.count({ where: { authorId: userIds[0], operationId } })).toBe(1);
    } finally {
      sender.close();
      receiver.close();
      await close(httpServer, io);
    }
  });

  it("rejects room access for users outside the workspace", async () => {
    const { httpServer, io, url } = await listen();
    const outsider = await connect(url, 2);
    try {
      await expect(join(outsider)).resolves.toMatchObject({ code: "CHANNEL_NOT_FOUND" });
    } finally {
      outsider.close();
      await close(httpServer, io);
    }
  });

  it("broadcasts DM messages only to direct conversation participants", async () => {
    const { httpServer, io, url } = await listen();
    const sender = await connect(url, 0);
    const receiver = await connect(url, 1);
    const outsider = await connect(url, 2);
    try {
      await expect(joinDm(sender)).resolves.toEqual({ ok: true });
      await expect(joinDm(receiver)).resolves.toEqual({ ok: true });
      await expect(joinDm(outsider)).resolves.toMatchObject({ code: "CONVERSATION_NOT_FOUND" });
      const operationId = randomUUID();
      const received = new Promise<unknown>((resolve) => receiver.once("message:new", resolve));
      const outsiderMessages: unknown[] = [];
      outsider.on("message:new", (event) => outsiderMessages.push(event));
      sender.emit("message:send", { operationId, workspaceId, conversation: { type: "dm", id: directConversationId }, content: "dm live" });
      await expect(received).resolves.toMatchObject({ message: { workspaceId, channelId: null, directConversationId, operationId, content: "dm live" } });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(outsiderMessages).toEqual([]);
    } finally {
      sender.close();
      receiver.close();
      outsider.close();
      await close(httpServer, io);
    }
  });

  it("broadcasts reaction and read updates in the authorized conversation room", async () => {
    const { httpServer, io, url } = await listen();
    const sender = await connect(url, 0);
    const receiver = await connect(url, 1);
    try {
      await join(sender);
      await join(receiver);
      const operationId = randomUUID();
      sender.emit("message:send", { operationId, workspaceId, conversation: { type: "channel", id: channelId }, content: "interactive" });
      const ack = await new Promise<MessageAckEvent>((resolve) => sender.once("message:ack", resolve));

      const reaction = new Promise<unknown>((resolve) => receiver.once("reaction:update", resolve));
      sender.emit("reaction:toggle", { workspaceId, messageId: ack.message.id, emoji: "👍" });
      await expect(reaction).resolves.toMatchObject({ messageId: ack.message.id, reactions: [{ emoji: "👍", count: 1 }] });

      const read = new Promise<unknown>((resolve) => sender.once("conversation:read:update", resolve));
      receiver.emit("conversation:read", { workspaceId, conversation: { type: "channel", id: channelId }, messageId: ack.message.id });
      await expect(read).resolves.toMatchObject({ readState: { userId: userIds[1], conversation: { type: "channel", id: channelId }, lastReadMessageId: ack.message.id } });
    } finally {
      sender.close();
      receiver.close();
      await close(httpServer, io);
    }
  });

  it("emits typing updates and delays offline presence until the final socket disconnects", async () => {
    const { httpServer, io, url } = await listen();
    const firstTab = await connect(url, 0);
    const secondTab = await connect(url, 0);
    const receiver = await connect(url, 1);
    try {
      await joinDm(firstTab);
      await joinDm(secondTab);
      await joinDm(receiver);
      const typingStarted = new Promise<unknown>((resolve) => receiver.once("typing:update", resolve));
      firstTab.emit("typing:start", { workspaceId, conversation: { type: "dm", id: directConversationId } });
      await expect(typingStarted).resolves.toMatchObject({ conversation: { type: "dm", id: directConversationId }, user: { id: userIds[0] }, typing: true });

      const presenceUpdates: unknown[] = [];
      receiver.on("presence:update", (event) => presenceUpdates.push(event));
      firstTab.close();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(presenceUpdates).not.toContainEqual({ userId: userIds[0], status: "offline" });
      secondTab.close();
      await new Promise((resolve) => setTimeout(resolve, 15_100));
      expect(presenceUpdates).toContainEqual({ userId: userIds[0], status: "offline" });
    } finally {
      firstTab.close();
      secondTab.close();
      receiver.close();
      await close(httpServer, io);
    }
  }, 20_000);

  it("publishes HTTP message mutations to connected authorized clients", async () => {
    const { httpServer, io, url } = await listen(true);
    const sender = await connect(url, 0);
    const receiver = await connect(url, 1);
    try {
      await join(sender);
      await join(receiver);
      const createdEvent = new Promise<unknown>((resolve) => receiver.once("message:new", resolve));
      const created = await request(httpServer)
        .post(`/api/channels/${channelId}/messages`)
        .set("Cookie", cookie(0))
        .send({ operationId: randomUUID(), content: "created over HTTP" })
        .expect(201);
      await expect(createdEvent).resolves.toMatchObject({ message: { id: created.body.message.id, content: "created over HTTP" } });

      const updatedEvent = new Promise<unknown>((resolve) => receiver.once("message:update", resolve));
      await request(httpServer).patch(`/api/messages/${created.body.message.id}`).set("Cookie", cookie(0)).send({ content: "edited over HTTP" }).expect(200);
      await expect(updatedEvent).resolves.toMatchObject({ message: { id: created.body.message.id, content: "edited over HTTP" } });

      const reactionEvent = new Promise<unknown>((resolve) => receiver.once("reaction:update", resolve));
      await request(httpServer).post(`/api/messages/${created.body.message.id}/reactions`).set("Cookie", cookie(0)).send({ emoji: "👍" }).expect(200);
      await expect(reactionEvent).resolves.toMatchObject({ messageId: created.body.message.id, reactions: [{ emoji: "👍", count: 1, reactedByMe: false }] });

      const readEvent = new Promise<unknown>((resolve) => sender.once("conversation:read:update", resolve));
      await request(httpServer).post(`/api/channels/${channelId}/read`).set("Cookie", cookie(1)).send({ messageId: created.body.message.id }).expect(200);
      await expect(readEvent).resolves.toMatchObject({ readState: { userId: userIds[1], lastReadMessageId: created.body.message.id } });

      const deletedEvent = new Promise<unknown>((resolve) => receiver.once("message:delete", resolve));
      await request(httpServer).delete(`/api/messages/${created.body.message.id}`).set("Cookie", cookie(0)).expect(200);
      await expect(deletedEvent).resolves.toMatchObject({ message: { id: created.body.message.id, content: "", deletedAt: expect.any(String) } });
    } finally {
      sender.close();
      receiver.close();
      await close(httpServer, io);
    }
  });

  it("stops delivering conversation broadcasts after membership removal", async () => {
    const { httpServer, io, url } = await listen();
    const sender = await connect(url, 0);
    const removedMember = await connect(url, 1);
    try {
      await expect(join(sender)).resolves.toEqual({ ok: true });
      await expect(join(removedMember)).resolves.toEqual({ ok: true });
      await database.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: userIds[1]! } },
        data: { status: "REMOVED", removedAt: new Date(), removedById: userIds[0] },
      });
      const received: unknown[] = [];
      removedMember.on("message:new", (event) => received.push(event));
      sender.emit("message:send", { operationId: randomUUID(), workspaceId, conversation: { type: "channel", id: channelId }, content: "private after removal" });
      await new Promise<MessageAckEvent>((resolve) => sender.once("message:ack", resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(received).toEqual([]);
    } finally {
      sender.close();
      removedMember.close();
      await close(httpServer, io);
    }
  });
});
