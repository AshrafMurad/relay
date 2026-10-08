import "dotenv/config";

import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const baseEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.url(),
  BETTER_AUTH_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.url().refine((url) => url.startsWith("postgresql://"), {
    message: "must use the postgresql protocol",
  }),
  REDIS_URL: z.url().refine((url) => url.startsWith("redis://") || url.startsWith("rediss://"), {
    message: "must use the redis or rediss protocol",
  }),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
  SMTP_SECURE: booleanString,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  EMAIL_FROM: z.string().min(1),
  UPLOAD_DIR: optionalString,
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  TRUST_PROXY: booleanString,
});

const environmentSchema = baseEnvironmentSchema.superRefine((environment, context) => {
  const hasGoogleClientId = environment.GOOGLE_CLIENT_ID !== undefined;
  const hasGoogleClientSecret = environment.GOOGLE_CLIENT_SECRET !== undefined;

  if (hasGoogleClientId !== hasGoogleClientSecret) {
    context.addIssue({
      code: "custom",
      path: [hasGoogleClientId ? "GOOGLE_CLIENT_SECRET" : "GOOGLE_CLIENT_ID"],
      message: "must be provided together with the other Google OAuth credential",
    });
  }

  if (environment.NODE_ENV === "production") {
    const webUrl = new URL(environment.WEB_ORIGIN);
    const authUrl = new URL(environment.BETTER_AUTH_URL);

    if (!environment.WEB_ORIGIN.startsWith("https://")) {
      context.addIssue({ code: "custom", path: ["WEB_ORIGIN"], message: "must use HTTPS in production" });
    }
    if (!environment.BETTER_AUTH_URL.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "must use HTTPS in production",
      });
    }
    if (webUrl.pathname !== "/" || webUrl.search || webUrl.hash) {
      context.addIssue({
        code: "custom",
        path: ["WEB_ORIGIN"],
        message: "must be an origin without a path, query, or fragment",
      });
    }
    if (authUrl.origin !== webUrl.origin || authUrl.pathname !== "/" || authUrl.search || authUrl.hash) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "must match WEB_ORIGIN in production",
      });
    }
    if (!environment.UPLOAD_DIR) {
      context.addIssue({
        code: "custom",
        path: ["UPLOAD_DIR"],
        message: "is required in production",
      });
    }
  }
});

export type Environment = Omit<z.infer<typeof environmentSchema>, "UPLOAD_DIR"> & {
  UPLOAD_DIR: string;
};

export function parseEnvironment(source: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    ...result.data,
    UPLOAD_DIR: result.data.UPLOAD_DIR ?? "./storage/uploads",
  };
}
