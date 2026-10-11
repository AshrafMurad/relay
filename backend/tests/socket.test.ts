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
  it.each([
    { name: "matching Origin", headers: { Origin: environment.WEB_ORIGIN }, status: 200 },
    { name: "same-origin polling without Origin", headers: { "Sec-Fetch-Site": "same-origin", Referer: `${environment.WEB_ORIGIN}/workspaces/demo` }, status: 200 },
    { name: "same-origin metadata without Referer", headers: { "Sec-Fetch-Site": "same-origin" }, status: 200 },
    { name: "matching Referer without fetch metadata", headers: { Referer: `${environment.WEB_ORIGIN}/workspaces/demo` }, status: 200 },
    { name: "foreign Origin despite same-origin metadata", headers: { Origin: "https://foreign.example", "Sec-Fetch-Site": "same-origin" }, status: 403 },
    { name: "null Origin", headers: { Origin: "null" }, status: 403 },
    { name: "cross-site metadata despite matching Referer", headers: { "Sec-Fetch-Site": "cross-site", Referer: environment.WEB_ORIGIN }, status: 403 },
    { name: "same-site sibling origin", headers: { "Sec-Fetch-Site": "same-site", Referer: "http://localhost:3001/" }, status: 403 },
    { name: "foreign Referer", headers: { Referer: "https://foreign.example/" }, status: 403 },
    { name: "malformed Referer", headers: { Referer: "invalid" }, status: 403 },
    { name: "no origin evidence", headers: {}, status: 403 },
  ])("checks polling handshake origin evidence: $name", async ({ headers, status }) => {
    const httpServer = createServer();
    openServers.push(httpServer);
    const io = createSocketServer(httpServer, environment, createLogger({ LOG_LEVEL: "fatal" }));
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/socket.io/?EIO=4&transport=polling`, {
        headers: headers as Record<string, string>,
      });
      expect(response.status).toBe(status);
      if (status === 200) expect(await response.text()).toMatch(/^0\{"sid":/);
      else expect(await response.json()).toEqual({ code: 4, message: "Forbidden" });
    } finally {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      openServers.splice(openServers.indexOf(httpServer), 1);
    }
  });

  it("uses typed domain:action system events", async () => {
    const httpServer = createServer();
    openServers.push(httpServer);
    const io = createSocketServer(httpServer, environment, createLogger({ LOG_LEVEL: "fatal" }));

    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected an assigned TCP port");

    const clients: Array<Socket<ServerToClientEvents, ClientToServerEvents>> = [
      createClient(`http://127.0.0.1:${address.port}`, {
        extraHeaders: { Origin: environment.WEB_ORIGIN },
      }),
      createClient(`http://127.0.0.1:${address.port}`, {
        transports: ["polling"],
        extraHeaders: { "Sec-Fetch-Site": "same-origin", Referer: `${environment.WEB_ORIGIN}/` },
      }),
    ];

    try {
      await Promise.all(clients.map(async (client) => {
        const ready = await new Promise<{ connectedAt: string }>((resolve) => {
          client.on("system:ready", resolve);
        });
        const pong = await new Promise<{ receivedAt: string }>((resolve) => {
          client.emit("system:ping", resolve);
        });

        expect(Date.parse(ready.connectedAt)).not.toBeNaN();
        expect(Date.parse(pong.receivedAt)).not.toBeNaN();
      }));
      expect(clients[0]!.id).not.toBe(clients[1]!.id);
    } finally {
      clients.forEach((client) => client.close());
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
