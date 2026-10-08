import { describe, expect, it } from "vitest";

import { ApiError } from "../src/lib/api-error.js";
import { validateAttachmentContent } from "../src/modules/attachments/attachment.service.js";

describe("attachment content validation", () => {
  it("accepts matching binary signatures", () => {
    expect(() => validateAttachmentContent(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).not.toThrow();
    expect(() => validateAttachmentContent(Buffer.from("%PDF-1.7"), "application/pdf")).not.toThrow();
  });

  it("rejects spoofed binary types and malformed text", () => {
    expect(() => validateAttachmentContent(Buffer.from("<script>alert(1)</script>"), "image/png")).toThrow(ApiError);
    expect(() => validateAttachmentContent(Buffer.from([0xff, 0xfe]), "text/plain")).toThrow(ApiError);
    expect(() => validateAttachmentContent(Buffer.from("not json"), "application/json")).toThrow(ApiError);
  });
});
