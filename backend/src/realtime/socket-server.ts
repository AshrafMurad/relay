import type { Server as HttpServer } from "node:http";
import type { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";

import type { Environment } from "../config/env.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../contracts/socket.js";
import type { Logger } from "../lib/logger.js";
import { ApiError } from "../lib/api-error.js";
import { getSessionByToken, SESSION_COOKIE_NAME } from "../modules/auth/auth.service.js";
import { createMessageSchema } from "../modules/messages/message.contracts.js";
import { createChannelMessage, requireAccessibleChannel } from "../modules/messages/message.service.js";

function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const cookie of header.split(";")) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

function channelRoom(channelId: string) {
  return `channel:${channelId}`;
}

function messageSequence(message: { createdAt: string; id: string }) {
  return `${message.createdAt}:${message.id}`;
}

function createWindowLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const current = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    if (current.length >= limit) {
      hits.set(key, current);
      return false;
    }
    current.push(now);
    hits.set(key, current);
    return true;
  };
}

function socketError(error: unknown, operationId?: string) {
  if (error instanceof ApiError) {
    return { operationId, code: error.code, message: error.message };
  }
  return { operationId, code: "INTERNAL_ERROR", message: "The socket event could not be processed." };
}

export function createSocketServer(
  httpServer: HttpServer,
  environment: Pick<Environment, "WEB_ORIGIN">,
  logger: Logger,
  prisma?: PrismaClient,
) {
  const allowJoin = createWindowLimiter(60, 60_000);
  const allowShortMessageSend = createWindowLimiter(30, 10_000);
  const allowLongMessageSend = createWindowLimiter(300, 5 * 60_000);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: environment.WEB_ORIGIN,
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    allowRequest(request, callback) {
      callback(null, request.headers.origin === environment.WEB_ORIGIN);
    },
  });

  if (prisma) {
    io.use(async (socket, next) => {
      try {
        const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE_NAME);
        const session = await getSessionByToken(prisma, token);
        if (!session) {
          next(new Error("UNAUTHORIZED"));
          return;
        }
        socket.data.userId = session.user.id;
        socket.data.email = session.user.email;
        next();
      } catch (error) {
        next(error instanceof Error ? error : new Error("UNAUTHORIZED"));
      }
    });
  }

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.userId }, "Socket connected");
    socket.emit("system:ready", { connectedAt: new Date().toISOString() });
    socket.on("system:ping", (acknowledge) => {
      if (typeof acknowledge !== "function") {
        logger.warn({ socketId: socket.id }, "Rejected malformed system:ping event");
        socket.disconnect(true);
        return;
      }
      acknowledge({ receivedAt: new Date().toISOString() });
    });

    socket.on("conversation:join", async (event, acknowledge) => {
      if (!prisma || !socket.data.userId || event?.conversation?.type !== "channel") {
        const error = { code: "UNAUTHORIZED", message: "Socket authentication is required." };
        acknowledge?.(error);
        socket.emit("message:error", error);
        return;
      }
      try {
        if (!allowJoin(socket.id)) throw new ApiError(429, "RATE_LIMITED", "Too many conversation join attempts.");
        const channel = await requireAccessibleChannel(prisma, event.conversation.id, socket.data.userId);
        if (channel.workspaceId !== event.workspaceId) throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel was not found.");
        await socket.join(channelRoom(channel.id));
        acknowledge?.({ ok: true });
      } catch (error) {
        const payload = socketError(error);
        acknowledge?.(payload);
        socket.emit("message:error", payload);
      }
    });

    socket.on("conversation:leave", async (event) => {
      if (event?.conversation?.type !== "channel") return;
      await socket.leave(channelRoom(event.conversation.id));
    });

    socket.on("message:send", async (event) => {
      if (!prisma || !socket.data.userId || event?.conversation?.type !== "channel") {
        socket.emit("message:error", { operationId: event?.operationId, code: "UNAUTHORIZED", message: "Socket authentication is required." });
        return;
      }
      try {
        if (!allowShortMessageSend(socket.data.userId) || !allowLongMessageSend(socket.data.userId)) {
          throw new ApiError(429, "MESSAGE_SEND_RATE_LIMITED", "Too many messages sent. Please wait before retrying.");
        }
        const channel = await requireAccessibleChannel(prisma, event.conversation.id, socket.data.userId);
        if (channel.workspaceId !== event.workspaceId) throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel was not found.");
        const parsed = createMessageSchema.safeParse({
          operationId: event.operationId,
          content: event.content,
          parentMessageId: event.parentMessageId,
        });
        if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Socket event data is invalid.");
        const result = await createChannelMessage(prisma, channel.id, socket.data.userId, parsed.data);
        const sequence = messageSequence(result.message);
        socket.emit("message:ack", { operationId: result.message.operationId, sequence, message: result.message });
        if (result.created) {
          socket.to(channelRoom(channel.id)).emit("message:new", { sequence, message: result.message });
        }
      } catch (error) {
        logger.warn({ socketId: socket.id, userId: socket.data.userId, error }, "Rejected message:send event");
        socket.emit("message:error", socketError(error, event?.operationId));
      }
    });
  });

  return io;
}
