import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import type { Environment } from "../config/env.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../contracts/socket.js";
import type { Logger } from "../lib/logger.js";

export function createSocketServer(
  httpServer: HttpServer,
  environment: Pick<Environment, "WEB_ORIGIN">,
  logger: Logger,
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

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");
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
