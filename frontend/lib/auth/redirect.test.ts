import { describe, expect, it } from "vitest"

import { safeNextPath } from "./redirect"

describe("safeNextPath", () => {
  it("keeps local invitation destinations", () => {
    expect(safeNextPath("/invite/abc123")).toBe("/invite/abc123")
  })

  it("rejects external and ambiguous destinations", () => {
    expect(safeNextPath("https://example.com")).toBe("/app")
    expect(safeNextPath("//example.com/path")).toBe("/app")
    expect(safeNextPath("/\\example.com/path")).toBe("/app")
    expect(safeNextPath(["/invite/a", "/invite/b"])).toBe("/app")
  })
})
