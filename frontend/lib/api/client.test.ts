import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("apiRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:4000/api")
    vi.stubEnv("NEXT_PUBLIC_SOCKET_URL", "http://localhost:4000")
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("aborts after the locked HTTP timeout with a useful API error", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
    })))
    const { apiRequest } = await import("./client")

    const request = apiRequest("/slow")
    const expectation = expect(request).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
      message: "Request timed out after 15 seconds.",
    })
    await vi.advanceTimersByTimeAsync(15_000)
    await expectation
  })

  it("respects a caller-provided abort signal", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Caller cancelled", "AbortError")), { once: true })
    })))
    const { apiRequest } = await import("./client")
    const controller = new AbortController()

    const request = apiRequest("/cancelled", { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: "AbortError" })
  })
})
