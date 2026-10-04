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
import { getSessionByToken, SESSION_COOKIE_NAME } from "../modules/auth/auth.service.js";

function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const cookie of header.split(";")) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

export function createSocketServer(
  httpServer: HttpServer,
  environment: Pick<Environment, "WEB_ORIGIN">,
  logger: Logger,
  prisma?: PrismaClient,
) {
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
  });

  return io;
}
