function requiredOrigin(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Invalid frontend environment configuration: ${name} is required to build the Content-Security-Policy`)
  }
  return new URL(value).origin
}

// Direct process.env.NEXT_PUBLIC_* reads are inlined at build time, so the
// proxy can assemble the policy without runtime environment access.
const apiOrigin = requiredOrigin(process.env.NEXT_PUBLIC_API_URL, "NEXT_PUBLIC_API_URL")
const socketOrigin = requiredOrigin(process.env.NEXT_PUBLIC_SOCKET_URL, "NEXT_PUBLIC_SOCKET_URL")
const webSocketOrigin = socketOrigin.replace(/^http/, "ws")

export function contentSecurityPolicy(nonce: string) {
  const isDevelopment = process.env.NODE_ENV === "development"
  const scriptSources = `'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`
  const connectSources = isDevelopment
    ? `'self' ${apiOrigin} ${socketOrigin} ${webSocketOrigin} http://localhost:* ws://localhost:*`
    : `'self' ${apiOrigin} ${socketOrigin} ${webSocketOrigin}`
  const directives = [
    "default-src 'self'",
    // Next.js hydrates through inline RSC payload scripts, so strict CSP needs
    // a per-request nonce; the proxy injects it and Next applies it to every
    // framework-generated script during server rendering.
    `script-src ${scriptSources}`,
    "style-src 'self' 'unsafe-inline'",
    // The seed workspace sources demo avatars from this host; everything else is first-party.
    `img-src 'self' data: blob: ${apiOrigin} https://api.dicebear.com`,
    "font-src 'self' data:",
    `connect-src ${connectSources}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ]
  return directives.join("; ")
}
