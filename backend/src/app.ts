import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import type { Environment } from "./config/env.js";
import type { DependencyProbe } from "./lib/database.js";
import type { Logger } from "./lib/logger.js";
import type { RealtimeEventBus } from "./realtime/realtime-events.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createUserRateLimit } from "./middleware/rate-limit.js";
import { createAttachmentRouter } from "./modules/attachments/attachment.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createIdentityImageRouter } from "./modules/identity-images/identity-image.routes.js";
import { createChannelRouter } from "./modules/channels/channel.routes.js";
import { createDirectConversationRouter } from "./modules/direct-conversations/direct-conversation.routes.js";
import { createChannelMessageRouter, createDirectMessageRouter, createMessageRouter } from "./modules/messages/message.routes.js";
import { createSearchRouter } from "./modules/search/search.routes.js";
import { createWorkspaceRouter } from "./modules/workspaces/workspace.routes.js";
import type { PrismaClient } from "@prisma/client";

export interface ApplicationDependencies {
  database: DependencyProbe & { prisma?: PrismaClient };
  redis: DependencyProbe;
  realtime?: RealtimeEventBus;
}

export function createApp(
  environment: Environment,
  dependencies: ApplicationDependencies,
  logger: Logger,
) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", environment.TRUST_PROXY);
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(request: IncomingMessage) {
          return {
            method: request.method,
            path: request.url?.split("?", 1)[0],
          };
        },
      },
      genReqId(request, response) {
        const requestId = request.headers["x-request-id"]?.toString() ?? randomUUID();
        response.setHeader("x-request-id", requestId);
        return requestId;
      },
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(
    cors({
      origin: environment.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  if (dependencies.database.prisma) {
    app.use(createAuthMiddleware(dependencies.database.prisma, environment.NODE_ENV === "production"));
    app.use(createUserRateLimit(300, 60_000, "RATE_LIMITED", "general-authenticated-api"));
    app.use("/api/auth", createAuthRouter(dependencies.database.prisma, environment));
    app.use("/api/workspaces", createWorkspaceRouter(dependencies.database.prisma, environment.UPLOAD_DIR, dependencies.realtime));
    app.use("/api", createDirectConversationRouter(dependencies.database.prisma));
    app.use("/api/channels", createChannelRouter(dependencies.database.prisma));
    app.use("/api/channels", createChannelMessageRouter(dependencies.database.prisma, dependencies.realtime));
    app.use("/api/direct-conversations", createDirectMessageRouter(dependencies.database.prisma, dependencies.realtime));
    app.use("/api/messages", createMessageRouter(dependencies.database.prisma, dependencies.realtime));
    app.use("/api/search", createSearchRouter(dependencies.database.prisma));
    app.use("/api/attachments", createAttachmentRouter(dependencies.database.prisma, environment.UPLOAD_DIR));
    app.use("/api/identity-images", createIdentityImageRouter(dependencies.database.prisma, environment.UPLOAD_DIR));
  }

  app.use("/api/health", createHealthRouter(dependencies.database, dependencies.redis));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
