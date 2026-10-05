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
import { requireAccessibleDirectConversation } from "../modules/direct-conversations/direct-conversation.service.js";
import { conversationReadSchema, createMessageSchema, reactionToggleSchema } from "../modules/messages/message.contracts.js";
import { createChannelMessage, createDirectMessage, markChannelRead, markDirectConversationRead, requireAccessibleChannel, toggleMessageReaction } from "../modules/messages/message.service.js";

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

function dmRoom(conversationId: string) {
  return `dm:${conversationId}`;
}

function workspaceRoom(workspaceId: string) {
  return `workspace:${workspaceId}`;
}

function fallbackMessageSequence(message: { createdAt: string; id: string }) {
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
  const allowTyping = createWindowLimiter(20, 10_000);
  const allowReaction = createWindowLimiter(60, 60_000);
  const activeSocketsByUser = new Map<string, Set<string>>();
  const presenceGraceTimers = new Map<string, NodeJS.Timeout>();
  const typingTimers = new Map<string, NodeJS.Timeout>();
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
    if (socket.data.userId) {
      const timer = presenceGraceTimers.get(socket.data.userId);
      if (timer) clearTimeout(timer);
      presenceGraceTimers.delete(socket.data.userId);
      const sockets = activeSocketsByUser.get(socket.data.userId) ?? new Set<string>();
      sockets.add(socket.id);
      activeSocketsByUser.set(socket.data.userId, sockets);
    }
    socket.emit("system:ready", { connectedAt: new Date().toISOString() });
    socket.on("system:ping", (acknowledge) => {
      if (typeof acknowledge !== "function") {
        logger.warn({ socketId: socket.id }, "Rejected malformed system:ping event");
        socket.disconnect(true);
        return;
      }
      acknowledge({ receivedAt: new Date().toISOString() });
    });

    async function authorizeConversation(event: { workspaceId?: string; conversation?: { type?: string; id?: string } }) {
      if (!prisma || !socket.data.userId) throw new ApiError(401, "UNAUTHORIZED", "Socket authentication is required.");
      if (event?.conversation?.type === "channel" && event.conversation.id) {
        const channel = await requireAccessibleChannel(prisma, event.conversation.id, socket.data.userId);
        if (channel.workspaceId !== event.workspaceId) throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel was not found.");
        return { type: "channel" as const, id: channel.id, workspaceId: channel.workspaceId, room: channelRoom(channel.id) };
      }
      if (event?.conversation?.type === "dm" && event.conversation.id) {
        const conversation = await requireAccessibleDirectConversation(prisma, event.conversation.id, socket.data.userId);
        if (conversation.workspaceId !== event.workspaceId) throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Direct conversation was not found.");
        return { type: "dm" as const, id: conversation.id, workspaceId: conversation.workspaceId, room: dmRoom(conversation.id) };
      }
      throw new ApiError(400, "VALIDATION_ERROR", "Conversation reference is invalid.");
    }

    function stopTyping(event: { workspaceId?: string; conversation?: { type?: string; id?: string } }, broadcast = true) {
      if (!socket.data.userId || !event?.conversation?.type || !event.conversation.id) return;
      const key = `${event.conversation.type}:${event.conversation.id}:${socket.data.userId}`;
      const timer = typingTimers.get(key);
      if (timer) clearTimeout(timer);
      typingTimers.delete(key);
      if (!broadcast) return;
      const room = event.conversation.type === "dm" ? dmRoom(event.conversation.id) : channelRoom(event.conversation.id);
      socket.to(room).emit("typing:update", {
        workspaceId: event.workspaceId ?? "",
        conversation: { type: event.conversation.type as "channel" | "dm", id: event.conversation.id },
        user: { id: socket.data.userId, name: socket.data.email ?? "Someone" },
        typing: false,
      });
    }

    socket.on("conversation:join", async (event, acknowledge) => {
      if (!prisma || !socket.data.userId) {
        const error = { code: "UNAUTHORIZED", message: "Socket authentication is required." };
        acknowledge?.(error);
        socket.emit("message:error", error);
        return;
      }
      try {
        if (!allowJoin(socket.id)) throw new ApiError(429, "RATE_LIMITED", "Too many conversation join attempts.");
        const conversation = await authorizeConversation(event);
        await socket.join(conversation.room);
        await socket.join(workspaceRoom(conversation.workspaceId));
        socket.data.workspaceIds ??= new Set<string>();
        socket.data.workspaceIds.add(conversation.workspaceId);
        socket.to(workspaceRoom(conversation.workspaceId)).emit("presence:update", { userId: socket.data.userId, status: "online" });
        acknowledge?.({ ok: true });
      } catch (error) {
        const payload = socketError(error);
        acknowledge?.(payload);
        socket.emit("message:error", payload);
      }
    });

    socket.on("conversation:leave", async (event) => {
      if (!event?.conversation?.id) return;
      stopTyping(event);
      await socket.leave(event.conversation.type === "dm" ? dmRoom(event.conversation.id) : channelRoom(event.conversation.id));
    });

    socket.on("message:send", async (event) => {
      if (!prisma || !socket.data.userId) {
        socket.emit("message:error", { operationId: event?.operationId, code: "UNAUTHORIZED", message: "Socket authentication is required." });
        return;
      }
      try {
        if (!allowShortMessageSend(socket.data.userId) || !allowLongMessageSend(socket.data.userId)) {
          throw new ApiError(429, "MESSAGE_SEND_RATE_LIMITED", "Too many messages sent. Please wait before retrying.");
        }
        const conversation = await authorizeConversation(event);
        const parsed = createMessageSchema.safeParse({
          operationId: event.operationId,
          content: event.content,
          parentMessageId: event.parentMessageId,
          attachmentIds: event.attachmentIds,
        });
        if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Socket event data is invalid.");
        const result = conversation.type === "channel"
          ? await createChannelMessage(prisma, conversation.id, socket.data.userId, parsed.data)
          : await createDirectMessage(prisma, conversation.id, socket.data.userId, parsed.data);
        const sequence = result.sequence ?? fallbackMessageSequence(result.message);
        socket.emit("message:ack", { operationId: result.message.operationId, sequence, message: result.message });
        if (result.created) {
          socket.to(conversation.room).emit("message:new", { sequence, message: result.message });
        }
        stopTyping(event);
      } catch (error) {
        logger.warn({ socketId: socket.id, userId: socket.data.userId, error }, "Rejected message:send event");
        socket.emit("message:error", socketError(error, event?.operationId));
      }
    });

    socket.on("reaction:toggle", async (event) => {
      if (!prisma || !socket.data.userId) {
        socket.emit("message:error", { code: "UNAUTHORIZED", message: "Socket authentication is required." });
        return;
      }
      try {
        if (!allowReaction(socket.data.userId)) throw new ApiError(429, "RATE_LIMITED", "Too many reaction changes.");
        const parsed = reactionToggleSchema.safeParse({ emoji: event.emoji });
        if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Socket event data is invalid.");
        const result = await toggleMessageReaction(prisma, event.messageId, socket.data.userId, parsed.data);
        if (result.conversation.workspaceId !== event.workspaceId) throw new ApiError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
        io.to(result.conversation.room).emit("reaction:update", {
          sequence: result.sequence,
          workspaceId: result.conversation.workspaceId,
          conversation: { type: result.conversation.type, id: result.conversation.id },
          messageId: result.messageId,
          reactions: result.reactions,
        });
      } catch (error) {
        socket.emit("message:error", socketError(error));
      }
    });

    socket.on("conversation:read", async (event) => {
      if (!prisma || !socket.data.userId) {
        socket.emit("message:error", { code: "UNAUTHORIZED", message: "Socket authentication is required." });
        return;
      }
      try {
        const conversation = await authorizeConversation(event);
        const parsed = conversationReadSchema.safeParse({ messageId: event.messageId });
        if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Socket event data is invalid.");
        const readState = conversation.type === "channel"
          ? await markChannelRead(prisma, conversation.id, socket.data.userId, parsed.data)
          : await markDirectConversationRead(prisma, conversation.id, socket.data.userId, parsed.data);
        io.to(conversation.room).emit("conversation:read:update", {
          sequence: `${readState.lastReadAt}:${readState.userId}:read`,
          readState,
        });
      } catch (error) {
        socket.emit("message:error", socketError(error));
      }
    });

    socket.on("typing:start", async (event) => {
      try {
        const conversation = await authorizeConversation(event);
        if (!allowTyping(`${socket.data.userId}:${conversation.type}:${conversation.id}`)) return;
        const key = `${conversation.type}:${conversation.id}:${socket.data.userId}`;
        const existing = typingTimers.get(key);
        if (existing) clearTimeout(existing);
        typingTimers.set(key, setTimeout(() => stopTyping(event), 5_000));
        socket.to(conversation.room).emit("typing:update", {
          workspaceId: conversation.workspaceId,
          conversation: { type: conversation.type, id: conversation.id },
          user: { id: socket.data.userId!, name: socket.data.email ?? "Someone" },
          typing: true,
        });
      } catch (error) {
        socket.emit("message:error", socketError(error));
      }
    });

    socket.on("typing:stop", async (event) => {
      try {
        await authorizeConversation(event);
        stopTyping(event);
      } catch (error) {
        socket.emit("message:error", socketError(error));
      }
    });

    socket.on("disconnect", () => {
      if (!socket.data.userId) return;
      for (const room of socket.rooms) {
        if (room.startsWith("channel:")) stopTyping({ workspaceId: "", conversation: { type: "channel", id: room.slice("channel:".length) } });
        if (room.startsWith("dm:")) stopTyping({ workspaceId: "", conversation: { type: "dm", id: room.slice("dm:".length) } });
      }
      const sockets = activeSocketsByUser.get(socket.data.userId);
      sockets?.delete(socket.id);
      if (sockets && sockets.size > 0) return;
      activeSocketsByUser.delete(socket.data.userId);
      const userId = socket.data.userId;
      presenceGraceTimers.set(userId, setTimeout(() => {
        presenceGraceTimers.delete(userId);
        if (!activeSocketsByUser.has(userId)) {
          for (const workspaceId of socket.data.workspaceIds ?? []) {
            io.to(workspaceRoom(workspaceId)).emit("presence:update", { userId, status: "offline" });
          }
        }
      }, 15_000));
    });
  });

  return io;
}
