import { parsePublicEnvironment } from "@/env"

import type { ApiErrorResponse } from "./contracts"

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
  const response = await fetch(`${environment.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorResponse | null
    throw new ApiClientError(body?.error.code ?? "REQUEST_FAILED", body?.error.message ?? "Request failed.")
  }

  if (response.status === 204) return undefined as TResponse
  return (await response.json()) as TResponse
}
