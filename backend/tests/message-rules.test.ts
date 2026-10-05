import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ApiError } from "../src/lib/api-error.js";
import { messageHistoryQuerySchema } from "../src/modules/messages/message.contracts.js";
import { decodeMessageCursor, encodeMessageCursor, normalizeMessageContent } from "../src/modules/messages/message.service.js";

describe("message content validation", () => {
  it("trims safe plain text", () => {
    expect(normalizeMessageContent("  hello <script>  ")).toBe("hello <script>");
  });

  it("rejects empty content with a stable code", () => {
    expect(() => normalizeMessageContent(" \n\t ")).toThrowError(expect.objectContaining({
      code: "MESSAGE_EMPTY",
    }) as ApiError);
  });

  it("counts Unicode code points rather than UTF-16 units", () => {
    expect(normalizeMessageContent("😀".repeat(4_000))).toHaveLength(8_000);
    expect(() => normalizeMessageContent("😀".repeat(4_001))).toThrowError(expect.objectContaining({
      code: "MESSAGE_TOO_LONG",
    }) as ApiError);
  });
});

describe("message history cursor", () => {
  it("round-trips a versioned opaque base64url cursor", () => {
    const createdAt = new Date("2026-10-05T12:34:56.789Z");
    const id = randomUUID();
    const cursor = encodeMessageCursor(createdAt, id);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeMessageCursor(cursor)).toEqual({ createdAt, id });
  });

  it.each([
    "not valid base64url!",
    Buffer.from("not json").toString("base64url"),
    Buffer.from(JSON.stringify({ v: 2, createdAt: new Date().toISOString(), id: randomUUID() })).toString("base64url"),
    Buffer.from(JSON.stringify({ v: 1, createdAt: "bad", id: randomUUID() })).toString("base64url"),
  ])("rejects malformed cursor %s", (cursor) => {
    expect(() => decodeMessageCursor(cursor)).toThrowError(expect.objectContaining({
      code: "INVALID_CURSOR",
    }) as ApiError);
  });

  it("defaults to 50 and caps page size at 100", () => {
    expect(messageHistoryQuerySchema.parse({}).limit).toBe(50);
    expect(messageHistoryQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    expect(messageHistoryQuerySchema.safeParse({ limit: "101" }).success).toBe(false);
  });
});
