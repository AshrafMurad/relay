import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { contentSecurityPolicy } from "./lib/csp"

// Generates a per-request CSP nonce and applies the strict production policy.
// Next.js reads the nonce from the request's Content-Security-Policy header and
// attaches it to the framework, bundle, and inline hydration scripts during
// server rendering, which requires dynamic rendering of every page.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const policy = contentSecurityPolicy(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", policy)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", policy)
  return response
}

export const config = {
  matcher: [
    {
      // Skip static assets and prefetches, which never execute scripts.
      source: "/((?!_next/static|_next/image|favicon.ico|theme-init.js|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
