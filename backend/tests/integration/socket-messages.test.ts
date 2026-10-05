import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import { io as createClient, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Environment } from "../../src/config/env.js";
import type { ClientToServerEvents, MessageAckEvent, ServerToClientEvents } from "../../src/contracts/socket.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { createSocketServer } from "../../src/realtime/socket-server.js";
import { createChannel } from "../../src/modules/channels/channel.service.js";
import { findOrCreateDirectConversation } from "../../src/modules/direct-conversations/direct-conversation.service.js";
import { createWorkspace } from "../../src/modules/workspaces/workspace.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const environment: Pick<Environment, "WEB_ORIGIN"> = { WEB_ORIGIN: "http://localhost:3000" };
const userIds = [randomUUID(), randomUUID(), randomUUID()];
const tokens = [randomUUID(), randomUUID(), randomUUID()];
const workspaceIds: string[] = [];
let workspaceId = "";
let channelId = "";
let directConversationId = "";

function cookie(index: number) {
  return `relay_session=${tokens[index]}`;
}

async function listen() {
  const httpServer = createServer();
  const io = createSocketServer(httpServer, environment, createLogger({ LOG_LEVEL: "fatal" }), database.prisma);
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
});
