import { createClient } from "redis";

import type { DependencyProbe } from "./database.js";
import type { Logger } from "./logger.js";

export interface RedisConnection extends DependencyProbe {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

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

  client.on("error", (error) => {
    logger.warn({ err: error }, "Redis connection error");
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
      if (client.isOpen) {
        await client.close();
      } else {
        client.destroy();
      }
    },
  };
}
