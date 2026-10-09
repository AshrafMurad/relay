import { parsePublicEnvironment } from "@/env"

import type { ApiErrorResponse } from "./contracts"

const HTTP_REQUEST_TIMEOUT_MS = 15_000
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000

const environment = parsePublicEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  NODE_ENV: process.env.NODE_ENV,
})

export const API_BASE_URL = environment.NEXT_PUBLIC_API_URL

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message)
  }
}

export async function apiRequest<TResponse>(path: string, init: RequestInit = {}) {
  const controller = new AbortController()
  let timedOut = false
  const abortFromCaller = () => controller.abort(init.signal?.reason)
  if (init.signal?.aborted) abortFromCaller()
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true })

  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, init.body instanceof FormData ? UPLOAD_REQUEST_TIMEOUT_MS : HTTP_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    const headers = new Headers(init.headers)
    if (!(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json")
    response = await fetch(`${environment.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers,
    })

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorResponse | null
      if (timedOut) throw new ApiClientError("REQUEST_TIMEOUT")
      throw new ApiClientError(body?.error.code ?? "REQUEST_FAILED")
    }

    if (response.status === 204) return undefined as TResponse
    return (await response.json()) as TResponse
  } catch (caught) {
    if (timedOut) {
      throw new ApiClientError("REQUEST_TIMEOUT")
    }
    throw caught
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener("abort", abortFromCaller)
  }
}
