import { createServer } from "node:http";

import { io as createClient, type Socket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import type { ClientToServerEvents, ServerToClientEvents } from "../src/contracts/socket.js";
import { createLogger } from "../src/lib/logger.js";
import { createSocketServer } from "../src/realtime/socket-server.js";

const environment = { WEB_ORIGIN: "http://localhost:3000" };

const openServers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("Socket.IO foundation", () => {
  it("uses typed domain:action system events", async () => {
    const httpServer = createServer();
    openServers.push(httpServer);
    const io = createSocketServer(httpServer, environment, createLogger({ LOG_LEVEL: "fatal" }));

    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port");

    const client: Socket<ServerToClientEvents, ClientToServerEvents> = createClient(
      `http://127.0.0.1:${address.port}`,
      { extraHeaders: { Origin: environment.WEB_ORIGIN } },
    );

    try {
      const ready = await new Promise<{ connectedAt: string }>((resolve) => {
        client.on("system:ready", resolve);
      });
      const pong = await new Promise<{ receivedAt: string }>((resolve) => {
        client.emit("system:ping", resolve);
      });

      expect(Date.parse(ready.connectedAt)).not.toBeNaN();
      expect(Date.parse(pong.receivedAt)).not.toBeNaN();
    } finally {
      client.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      openServers.splice(openServers.indexOf(httpServer), 1);
    }
  });

  it("does not crash when a client omits the acknowledgement callback", async () => {
    const httpServer = createServer();
    openServers.push(httpServer);
    const io = createSocketServer(httpServer, environment, createLogger({ LOG_LEVEL: "fatal" }));

    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port");

    const client = createClient(`http://127.0.0.1:${address.port}`, {
      extraHeaders: { Origin: environment.WEB_ORIGIN },
    });

    try {
      await new Promise<void>((resolve) => client.on("connect", () => resolve()));
      const disconnected = new Promise<void>((resolve) => client.on("disconnect", () => resolve()));
      client.emit("system:ping");
      await disconnected;
      expect(httpServer.listening).toBe(true);
    } finally {
      client.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      openServers.splice(openServers.indexOf(httpServer), 1);
    }
  });
});
