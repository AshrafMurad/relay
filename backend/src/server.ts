import { createServer } from "node:http";

import { createApp } from "./app.js";
import { parseEnvironment } from "./config/env.js";
import { createDatabase } from "./lib/database.js";
import { createLogger } from "./lib/logger.js";
import { createRedisConnection } from "./lib/redis.js";
import { createSocketServer } from "./realtime/socket-server.js";
import { RealtimeEventBus } from "./realtime/realtime-events.js";
import { cleanupExpiredPendingAttachments } from "./modules/attachments/attachment.service.js";

const SHUTDOWN_TIMEOUT_MS = 30_000;

export async function startServer(source: NodeJS.ProcessEnv = process.env) {
  const environment = parseEnvironment(source);
  const logger = createLogger(environment);
  const database = createDatabase(environment.DATABASE_URL);
  const redis = createRedisConnection(environment.REDIS_URL, logger);

  try {
    await database.connect();
  } catch (error) {
    await database.disconnect().catch(() => undefined);
    throw error;
  }
  const realtime = new RealtimeEventBus();
  const app = createApp(environment, { database, redis, realtime }, logger);
  const httpServer = createServer(app);
  httpServer.requestTimeout = 15_000;
  httpServer.headersTimeout = 16_000;
  const io = createSocketServer(httpServer, environment, logger, database.prisma, realtime, redis);

  try {
    try {
      await redis.connect();
    } catch (error) {
      logger.warn({ err: error }, "Redis unavailable; starting in degraded mode");
    }

    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(environment.PORT, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    io.disconnectSockets(true);
    io.close();
    httpServer.closeAllConnections();
    await Promise.allSettled([redis.disconnect(), database.disconnect()]);
    throw error;
  }

  logger.info({ port: environment.PORT }, "Relay API listening");
  const cleanupAttachments = () => cleanupExpiredPendingAttachments(database.prisma, environment.UPLOAD_DIR)
    .then((removed) => { if (removed > 0) logger.info({ removed }, "Expired pending attachments removed"); })
    .catch((error) => logger.error({ err: error }, "Pending attachment cleanup failed"));
  void cleanupAttachments();
  const attachmentCleanupTimer = setInterval(() => void cleanupAttachments(), 60 * 60_000);
  attachmentCleanupTimer.unref();

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(attachmentCleanupTimer);
    logger.info({ signal }, "Graceful shutdown started");

    const closeServices = async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.allSettled([redis.disconnect(), database.disconnect()]);
    };

    const timedOut = new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Graceful shutdown timed out")), SHUTDOWN_TIMEOUT_MS).unref();
    });

    try {
      await Promise.race([closeServices(), timedOut]);
      logger.info("Graceful shutdown complete");
      process.exitCode = 0;
    } catch (error) {
      logger.error({ err: error }, "Graceful shutdown failed");
      io.disconnectSockets(true);
      httpServer.closeAllConnections();
      process.exit(1);
    }
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  return { app, httpServer, io, shutdown };
}
