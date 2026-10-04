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
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createHealthRouter } from "./modules/health/health.routes.js";

export interface ApplicationDependencies {
  database: DependencyProbe;
  redis: DependencyProbe;
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
  app.use(helmet());
  app.use(
    cors({
      origin: environment.WEB_ORIGIN,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/health", createHealthRouter(dependencies.database, dependencies.redis));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
