import { describe, expect, it } from "vitest";

import { parsePublicEnvironment } from "./env";

describe("parsePublicEnvironment", () => {
  it("accepts the documented local URLs", () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
        NEXT_PUBLIC_SOCKET_URL: "http://localhost:4000",
      }),
    ).toEqual({
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api",
      NEXT_PUBLIC_SOCKET_URL: "http://localhost:4000",
    });
  });

  it("rejects an API URL without the API prefix", () => {
    expect(() =>
      parsePublicEnvironment({
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        NEXT_PUBLIC_SOCKET_URL: "http://localhost:4000",
      }),
    ).toThrow("NEXT_PUBLIC_API_URL");
  });

  it("requires one HTTPS origin in production", () => {
    expect(() =>
      parsePublicEnvironment({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://relay.example.com/api",
        NEXT_PUBLIC_SOCKET_URL: "https://socket.example.com",
      }),
    ).toThrow("one origin");
  });
});
