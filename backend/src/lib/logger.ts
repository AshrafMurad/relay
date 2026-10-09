import pino from "pino";

import type { Environment } from "../config/env.js";

export function createLogger(environment: Pick<Environment, "LOG_LEVEL">) {
  return pino({
    level: environment.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.set-cookie",
        "*.password",
        "*.secret",
        "*.token",
        "*.accessToken",
        "*.refreshToken",
        "*.idToken",
        "*.sessionToken",
      ],
      censor: "[REDACTED]",
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;
