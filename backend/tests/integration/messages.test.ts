import { createHash, randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import { createDatabase } from "../../src/lib/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { archiveChannel, createChannel } from "../../src/modules/channels/channel.service.js";
import { createWorkspace } from "../../src/modules/workspaces/workspace.service.js";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://relay:relay@localhost:5432/relay";
const database = createDatabase(databaseUrl);
const available = { probe: async () => true };
const environment: Environment = {
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:3000",
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
let otherChannelId = "";
let archivedChannelId = "";
let archivedMessageId = "";
let archivedOperationId = "";

function cookie(index: number) {
  return `relay_session=${tokens[index]}`;
}

beforeAll(async () => {
  await database.connect();
  await database.prisma.user.createMany({
    data: userIds.map((id, index) => ({ id, email: `message-${id}@relay.test`, name: `Message User ${index + 1}`, emailVerified: true })),
  });
  await database.prisma.session.createMany({
    data: tokens.map((token, index) => ({
      userId: userIds[index]!,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    })),
  });
  const workspace = await createWorkspace(database.prisma, userIds[0]!, { name: `Messages ${randomUUID()}` });
  workspaceId = workspace.id;
  workspaceIds.push(workspace.id);
  await database.prisma.workspaceMember.create({ data: { workspaceId, userId: userIds[1]!, role: "MEMBER" } });
  channelId = (await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `messages-${randomUUID().slice(0, 8)}` })).id;
  otherChannelId = (await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `other-${randomUUID().slice(0, 8)}` })).id;
  archivedChannelId = (await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `archived-${randomUUID().slice(0, 8)}` })).id;
  archivedOperationId = randomUUID();
  archivedMessageId = (await database.prisma.message.create({
    data: {
      workspaceId,
      channelId: archivedChannelId,
      authorId: userIds[0]!,
      operationId: archivedOperationId,
      content: "before archive",
    },
  })).id;
  await archiveChannel(database.prisma, archivedChannelId, userIds[0]!);

  const outside = await createWorkspace(database.prisma, userIds[2]!, { name: `Outside ${randomUUID()}` });
  workspaceIds.push(outside.id);
});

afterAll(async () => {
  await database.prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await database.prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await database.disconnect();
});

const app = createApp(environment, { database, redis: available }, createLogger(environment));

describe("durable channel message HTTP API", () => {
  it("requires authentication and hides channels from outsiders", async () => {
    await request(app).get(`/api/channels/${channelId}/messages`).expect(401);
    const response = await request(app).get(`/api/channels/${channelId}/messages`).set("Cookie", cookie(2)).expect(404);
    expect(response.body).toMatchObject({ error: { code: "CHANNEL_NOT_FOUND" } });
  });

  it("creates once, trims content, and returns a replay with 200", async () => {
    const operationId = randomUUID();
    const body = { operationId, content: "  durable hello  " };
    const created = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send(body).expect(201);
    expect(created.body.message).toMatchObject({
      workspaceId,
      channelId,
      operationId,
      content: "durable hello",
      author: { id: userIds[0], name: "Message User 1", image: null },
      parent: null,
      editedAt: null,
      deletedAt: null,
    });

    const replay = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ ...body, content: "changed retry" }).expect(200);
    expect(replay.body.message.id).toBe(created.body.message.id);
    expect(replay.body.message.content).toBe("durable hello");
    expect(await database.prisma.message.count({ where: { authorId: userIds[0], operationId } })).toBe(1);
  });

  it("resolves concurrent sends with one creation and one replay", async () => {
    const operationId = randomUUID();
    const send = () => request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId, content: "concurrent" });
    const responses = await Promise.all([send(), send()]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(responses[0]!.body.message.id).toBe(responses[1]!.body.message.id);
    expect(await database.prisma.message.count({ where: { authorId: userIds[0], operationId } })).toBe(1);
  });

  it("uses stable content errors and rejects operation reuse in another channel", async () => {
    const empty = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "  " }).expect(400);
    expect(empty.body).toMatchObject({ error: { code: "MESSAGE_EMPTY" } });
    const long = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "😀".repeat(4_001) }).expect(400);
    expect(long.body).toMatchObject({ error: { code: "MESSAGE_TOO_LONG" } });

    const operationId = randomUUID();
    await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId, content: "first" }).expect(201);
    await request(app).post(`/api/channels/${otherChannelId}/messages`).set("Cookie", cookie(0)).send({ operationId, content: "second" }).expect(409);
  });

  it("allows replies to deleted parents only in the same channel", async () => {
    const parent = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "parent" }).expect(201);
    await request(app).delete(`/api/messages/${parent.body.message.id}`).set("Cookie", cookie(0)).expect(200);

    const reply = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(1)).send({
      operationId: randomUUID(),
      content: "reply",
      parentMessageId: parent.body.message.id,
    }).expect(201);
    expect(reply.body.message.parent).toMatchObject({ id: parent.body.message.id, content: "", deletedAt: expect.any(String) });

    const crossChannel = await request(app).post(`/api/channels/${otherChannelId}/messages`).set("Cookie", cookie(1)).send({
      operationId: randomUUID(),
      content: "invalid reply",
      parentMessageId: parent.body.message.id,
    }).expect(404);
    expect(crossChannel.body).toMatchObject({ error: { code: "MESSAGE_NOT_FOUND" } });
  });

  it("enforces author-only edit/delete and preserves a tombstone", async () => {
    const created = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "original" }).expect(201);
    const id = created.body.message.id as string;
    await request(app).patch(`/api/messages/${id}`).set("Cookie", cookie(1)).send({ content: "stolen" }).expect(403);
    const edited = await request(app).patch(`/api/messages/${id}`).set("Cookie", cookie(0)).send({ content: " edited " }).expect(200);
    expect(edited.body.message).toMatchObject({ content: "edited", editedAt: expect.any(String) });
    await request(app).delete(`/api/messages/${id}`).set("Cookie", cookie(1)).expect(403);
    const deleted = await request(app).delete(`/api/messages/${id}`).set("Cookie", cookie(0)).expect(200);
    expect(deleted.body.message).toMatchObject({ id, content: "", deletedAt: expect.any(String) });
    expect(await database.prisma.message.findUnique({ where: { id } })).not.toBeNull();
    await request(app).patch(`/api/messages/${id}`).set("Cookie", cookie(0)).send({ content: "revive" }).expect(404);
  });

  it("keeps archived history readable while rejecting creates and edits", async () => {
    const archivedHistory = await request(app).get(`/api/channels/${archivedChannelId}/messages`).set("Cookie", cookie(0)).expect(200);
    expect(archivedHistory.body).toMatchObject({ messages: [{ id: archivedMessageId }], nextCursor: null, hasMore: false });
    const replay = await request(app).post(`/api/channels/${archivedChannelId}/messages`).set("Cookie", cookie(0)).send({ operationId: archivedOperationId, content: "retry" }).expect(200);
    expect(replay.body.message).toMatchObject({ id: archivedMessageId, content: "before archive" });
    const rejected = await request(app).post(`/api/channels/${archivedChannelId}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "no" }).expect(409);
    expect(rejected.body).toMatchObject({ error: { code: "CHANNEL_ARCHIVED" } });
    const edit = await request(app).patch(`/api/messages/${archivedMessageId}`).set("Cookie", cookie(0)).send({ content: "no" }).expect(409);
    expect(edit.body).toMatchObject({ error: { code: "CHANNEL_ARCHIVED" } });
  });

  it("paginates newest pages and returns each page oldest-first", async () => {
    const paginationChannel = await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `paging-${randomUUID().slice(0, 8)}` });
    await database.prisma.message.createMany({
      data: ["one", "two", "three"].map((content, index) => ({
        workspaceId,
        channelId: paginationChannel.id,
        authorId: userIds[0]!,
        operationId: randomUUID(),
        content,
        createdAt: new Date(Date.UTC(2026, 9, 5, 12, 0, index)),
        updatedAt: new Date(Date.UTC(2026, 9, 5, 12, 0, index)),
      })),
    });
    const first = await request(app).get(`/api/channels/${paginationChannel.id}/messages?limit=2`).set("Cookie", cookie(0)).expect(200);
    expect(first.body.messages.map((message: { content: string }) => message.content)).toEqual(["two", "three"]);
    expect(first.body).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });
    const second = await request(app).get(`/api/channels/${paginationChannel.id}/messages?limit=2&cursor=${first.body.nextCursor}`).set("Cookie", cookie(0)).expect(200);
    expect(second.body.messages.map((message: { content: string }) => message.content)).toEqual(["one"]);
    expect(second.body).toMatchObject({ hasMore: false, nextCursor: null });
    const invalid = await request(app).get(`/api/channels/${paginationChannel.id}/messages?cursor=bad!`).set("Cookie", cookie(0)).expect(400);
    expect(invalid.body).toMatchObject({ error: { code: "INVALID_CURSOR" } });
    const empty = await request(app).get(`/api/channels/${paginationChannel.id}/messages?cursor=`).set("Cookie", cookie(0)).expect(400);
    expect(empty.body).toMatchObject({ error: { code: "INVALID_CURSOR" } });

    const tiedChannel = await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `ties-${randomUUID().slice(0, 8)}` });
    const tiedAt = new Date("2026-10-05T13:00:00.123Z");
    const tiedIds = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ];
    await database.prisma.message.createMany({
      data: tiedIds.map((id) => ({ id, workspaceId, channelId: tiedChannel.id, authorId: userIds[0]!, operationId: randomUUID(), content: id, createdAt: tiedAt, updatedAt: tiedAt })),
    });
    const tiedFirst = await request(app).get(`/api/channels/${tiedChannel.id}/messages?limit=2`).set("Cookie", cookie(0)).expect(200);
    expect(tiedFirst.body.messages.map((message: { id: string }) => message.id)).toEqual(tiedIds.slice(1));
    const tiedSecond = await request(app).get(`/api/channels/${tiedChannel.id}/messages?limit=2&cursor=${tiedFirst.body.nextCursor}`).set("Cookie", cookie(0)).expect(200);
    expect(tiedSecond.body.messages.map((message: { id: string }) => message.id)).toEqual(tiedIds.slice(0, 1));
  });

  it("creates one workspace-scoped DM and isolates its messages to participants", async () => {
    const created = await request(app).post(`/api/workspaces/${workspaceId}/direct-conversations`).set("Cookie", cookie(0)).send({ userId: userIds[1] }).expect(201);
    const replay = await request(app).post(`/api/workspaces/${workspaceId}/direct-conversations`).set("Cookie", cookie(1)).send({ userId: userIds[0] }).expect(201);
    expect(replay.body.conversation.id).toBe(created.body.conversation.id);
    expect(await database.prisma.directConversation.count({ where: { workspaceId } })).toBe(1);

    const operationId = randomUUID();
    const message = await request(app).post(`/api/direct-conversations/${created.body.conversation.id}/messages`).set("Cookie", cookie(0)).send({ operationId, content: "  private hello  " }).expect(201);
    expect(message.body.message).toMatchObject({ workspaceId, channelId: null, directConversationId: created.body.conversation.id, operationId, content: "private hello" });
    await request(app).get(`/api/direct-conversations/${created.body.conversation.id}/messages`).set("Cookie", cookie(1)).expect(200);
    await request(app).get(`/api/direct-conversations/${created.body.conversation.id}/messages`).set("Cookie", cookie(2)).expect(404);
    await request(app).post(`/api/workspaces/${workspaceId}/direct-conversations`).set("Cookie", cookie(0)).send({ userId: userIds[2] }).expect(404);
  });

  it("toggles reactions once per user and hides messages from outsiders", async () => {
    const created = await request(app).post(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "reactable" }).expect(201);
    const messageId = created.body.message.id as string;

    const added = await request(app).post(`/api/messages/${messageId}/reactions`).set("Cookie", cookie(1)).send({ emoji: "👍" }).expect(200);
    expect(added.body).toMatchObject({ messageId, reactions: [{ emoji: "👍", count: 1, reactedByMe: true }] });
    const listed = await request(app).get(`/api/channels/${channelId}/messages`).set("Cookie", cookie(0)).expect(200);
    expect(listed.body.messages.find((message: { id: string }) => message.id === messageId).reactions).toMatchObject([{ emoji: "👍", count: 1, reactedByMe: false }]);

    const removed = await request(app).post(`/api/messages/${messageId}/reactions`).set("Cookie", cookie(1)).send({ emoji: "👍" }).expect(200);
    expect(removed.body.reactions).toEqual([]);
    await request(app).post(`/api/messages/${messageId}/reactions`).set("Cookie", cookie(2)).send({ emoji: "👍" }).expect(404);
  });

  it("persists monotonic channel read state and unread counts", async () => {
    const readChannel = await createChannel(database.prisma, workspaceId, userIds[0]!, { name: `read-${randomUUID().slice(0, 8)}` });
    const first = await request(app).post(`/api/channels/${readChannel.id}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "first unread" }).expect(201);
    const second = await request(app).post(`/api/channels/${readChannel.id}/messages`).set("Cookie", cookie(0)).send({ operationId: randomUUID(), content: "second unread" }).expect(201);

    const withUnread = await request(app).get(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(1)).expect(200);
    expect(withUnread.body.channels.find((channel: { id: string }) => channel.id === readChannel.id)).toMatchObject({ unreadCount: 2, lastReadMessageId: null, lastMessageAt: second.body.message.createdAt });

    const read = await request(app).post(`/api/channels/${readChannel.id}/read`).set("Cookie", cookie(1)).send({ messageId: second.body.message.id }).expect(200);
    expect(read.body.readState).toMatchObject({ userId: userIds[1], conversation: { type: "channel", id: readChannel.id }, lastReadMessageId: second.body.message.id });
    await request(app).post(`/api/channels/${readChannel.id}/read`).set("Cookie", cookie(1)).send({ messageId: first.body.message.id }).expect(200);

    const afterRead = await request(app).get(`/api/workspaces/${workspaceId}/channels`).set("Cookie", cookie(1)).expect(200);
    expect(afterRead.body.channels.find((channel: { id: string }) => channel.id === readChannel.id)).toMatchObject({ unreadCount: 0, lastReadMessageId: second.body.message.id });
    await request(app).post(`/api/channels/${readChannel.id}/read`).set("Cookie", cookie(2)).send({ messageId: second.body.message.id }).expect(404);
  });

  it("revokes access after active membership removal", async () => {
    await database.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: userIds[1]! } },
      data: { status: "REMOVED", removedAt: new Date(), removedById: userIds[0] },
    });
    await request(app).get(`/api/channels/${channelId}/messages`).set("Cookie", cookie(1)).expect(404);
  });
});
