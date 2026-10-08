import { describe, expect, it } from "vitest";

import { parseEnvironment } from "../src/config/env.js";

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "development-only-secret-at-least-32-characters",
  DATABASE_URL: "postgresql://relay:relay@localhost:5432/relay",
  REDIS_URL: "redis://localhost:6379",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  EMAIL_FROM: "Relay <no-reply@relay.local>",
  TRUST_PROXY: "false",
};

describe("parseEnvironment", () => {
  it("applies documented development defaults", () => {
    const environment = parseEnvironment(validEnvironment);

    expect(environment.PORT).toBe(4000);
    expect(environment.UPLOAD_DIR).toBe("./storage/uploads");
    expect(environment.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("requires Google credentials as a pair", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, GOOGLE_CLIENT_ID: "client-id" }),
    ).toThrow("GOOGLE_CLIENT_SECRET");
  });

  it("does not include secret values in validation errors", () => {
    const secret = "too-short";

    expect(() =>
      parseEnvironment({ ...validEnvironment, BETTER_AUTH_SECRET: secret }),
    ).toThrowError(new RegExp(`^(?!.*${secret}).*$`));
  });

  it("requires HTTPS in production", () => {
    expect(() =>
      parseEnvironment({ ...validEnvironment, NODE_ENV: "production" }),
    ).toThrow("HTTPS");
  });

  it("requires one public origin in production", () => {
    expect(() =>
      parseEnvironment({
        ...validEnvironment,
        NODE_ENV: "production",
        WEB_ORIGIN: "https://relay.example.com",
        BETTER_AUTH_URL: "https://auth.example.com",
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        UPLOAD_DIR: "/data/uploads",
      }),
    ).toThrow("must match WEB_ORIGIN");
  });
});
