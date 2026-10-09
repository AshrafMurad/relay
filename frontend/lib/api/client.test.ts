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
    const expectation = expect(request).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" })
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

  it("allows a multipart upload past 15 seconds and aborts at 60 seconds", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
    }))
    vi.stubGlobal("fetch", fetchMock)
    const { apiRequest } = await import("./client")
    const form = new FormData()
    form.set("file", new File(["upload"], "upload.txt"))
    const request = apiRequest("/attachments", { method: "POST", body: form })
    const expectation = expect(request).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" })
    await vi.advanceTimersByTimeAsync(15_000)
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(45_000)
    await expectation
  })

  it("keeps the deadline active until the response body has been read", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
      }),
    })))
    const { apiRequest } = await import("./client")
    const expectation = expect(apiRequest("/slow-body")).rejects.toMatchObject({ code: "REQUEST_TIMEOUT" })
    await vi.advanceTimersByTimeAsync(15_000)
    await expectation
  })

  it("uses API error codes without exposing backend messages", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Internal backend detail" } }), { status: 403 }))))
    const { apiRequest } = await import("./client")

    await expect(apiRequest("/forbidden")).rejects.toMatchObject({ code: "FORBIDDEN", message: "FORBIDDEN" })
  })
})
