import { createClient } from "redis";
import { randomUUID } from "node:crypto";

import type { DependencyProbe } from "./database.js";
import type { Logger } from "./logger.js";

export interface RedisConnection extends DependencyProbe {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  markPresenceOnline(userId: string, socketId: string): Promise<void>;
  refreshPresence(userId: string, socketId: string): Promise<void>;
  removePresence(userId: string, socketId: string): Promise<void>;
  getOnlineUserIds(userIds: string[]): Promise<string[]>;
  publishPresence(event: PresencePublication): Promise<void>;
  subscribePresence(listener: (event: PresencePublication) => void): void;
  publishWorkspaceRevocation(workspaceId: string, userId: string): Promise<void>;
  subscribeWorkspaceRevocation(listener: (workspaceId: string, userId: string) => void): void;
}

export interface PresencePublication {
  workspaceId: string;
  userId: string;
  status: "online" | "offline";
}

const PRESENCE_CHANNEL = "presence:updates";
const WORKSPACE_REVOCATION_CHANNEL = "workspace:revocations";
const PRESENCE_LEASE_MS = 75_000;

export function createRedisConnection(url: string, logger: Logger): RedisConnection {
  let connectionAttempt: Promise<void> | undefined;
  const client = createClient({
    url,
    socket: {
      reconnectStrategy(retries) {
        return Math.min(1_000 * 2 ** retries, 30_000);
      },
    },
  });
  const subscriber = client.duplicate();
  const instanceId = randomUUID();
  let presenceListener: ((event: PresencePublication) => void) | undefined;
  let workspaceRevocationListener: ((workspaceId: string, userId: string) => void) | undefined;

  client.on("error", (error) => {
    logger.warn({ err: error }, "Redis connection error");
  });
  subscriber.on("error", (error) => {
    logger.warn({ err: error }, "Redis subscriber connection error");
  });

  return {
    async connect() {
      if (client.isOpen) return;

      connectionAttempt ??= client
        .connect()
        .then(() => undefined)
        .finally(() => {
          connectionAttempt = undefined;
        });

      let timeout: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          connectionAttempt,
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error("Redis connection timed out")), 2_000);
          }),
        ]);
        if (!subscriber.isOpen) await subscriber.connect();
        await subscriber.subscribe(PRESENCE_CHANNEL, (message) => {
          try {
            const event = JSON.parse(message) as Partial<PresencePublication>;
            if (event.workspaceId && event.userId && (event.status === "online" || event.status === "offline")) {
              presenceListener?.(event as PresencePublication);
            }
          } catch (error) {
            logger.warn({ err: error }, "Rejected malformed Redis presence event");
          }
        });
        await subscriber.subscribe(WORKSPACE_REVOCATION_CHANNEL, (message) => {
          try {
            const event = JSON.parse(message) as { workspaceId?: string; userId?: string };
            if (event.workspaceId && event.userId) workspaceRevocationListener?.(event.workspaceId, event.userId);
          } catch (error) {
            logger.warn({ err: error }, "Rejected malformed Redis workspace revocation");
          }
        });
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
    async probe() {
      if (!client.isReady) {
        return false;
      }

      try {
        return (await client.ping()) === "PONG";
      } catch {
        return false;
      }
    },
    async disconnect() {
      if (subscriber.isOpen) {
        await subscriber.close();
      } else {
        subscriber.destroy();
      }
      if (client.isOpen) {
        await client.close();
      } else {
        client.destroy();
      }
    },
    async markPresenceOnline(userId, socketId) {
      const key = `presence:user:${userId}`;
      const now = Date.now();
      await client.zRemRangeByScore(key, 0, now);
      await client.zAdd(key, { score: now + PRESENCE_LEASE_MS, value: `${instanceId}:${socketId}` });
      await client.expire(key, Math.ceil(PRESENCE_LEASE_MS / 1_000) + 15);
    },
    async refreshPresence(userId, socketId) {
      const key = `presence:user:${userId}`;
      await client.zAdd(key, { score: Date.now() + PRESENCE_LEASE_MS, value: `${instanceId}:${socketId}` });
      await client.expire(key, Math.ceil(PRESENCE_LEASE_MS / 1_000) + 15);
    },
    async removePresence(userId, socketId) {
      await client.zRem(`presence:user:${userId}`, `${instanceId}:${socketId}`);
    },
    async getOnlineUserIds(userIds) {
      const now = Date.now();
      const online = await Promise.all(userIds.map(async (userId) => {
        const key = `presence:user:${userId}`;
        await client.zRemRangeByScore(key, 0, now);
        return await client.zCard(key) > 0 ? userId : undefined;
      }));
      return online.filter((userId): userId is string => Boolean(userId));
    },
    async publishPresence(event) {
      await client.publish(PRESENCE_CHANNEL, JSON.stringify(event));
    },
    subscribePresence(listener) {
      presenceListener = listener;
    },
    async publishWorkspaceRevocation(workspaceId, userId) {
      await client.publish(WORKSPACE_REVOCATION_CHANNEL, JSON.stringify({ workspaceId, userId }));
    },
    subscribeWorkspaceRevocation(listener) {
      workspaceRevocationListener = listener;
    },
  };
}
