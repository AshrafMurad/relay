import { parsePublicEnvironment } from "@/env"

import type { ApiErrorResponse } from "./contracts"

const HTTP_REQUEST_TIMEOUT_MS = 15_000

const environment = parsePublicEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  NODE_ENV: process.env.NODE_ENV,
})

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
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
  }, HTTP_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${environment.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
    })
  } catch (caught) {
    if (timedOut) {
      throw new ApiClientError("REQUEST_TIMEOUT", "Request timed out after 15 seconds.")
    }
    throw caught
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener("abort", abortFromCaller)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null
    throw new ApiClientError(body?.error.code ?? "REQUEST_FAILED", body?.error.message ?? "Request failed.")
  }

  if (response.status === 204) return undefined as TResponse
  return (await response.json()) as TResponse
}
