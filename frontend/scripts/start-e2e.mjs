import { cp } from "node:fs/promises"

// Match the Docker runner's standalone artifact and asset layout.
await cp(new URL("../public/", import.meta.url), new URL("../.next/standalone/public/", import.meta.url), { recursive: true })
await cp(new URL("../.next/static/", import.meta.url), new URL("../.next/standalone/.next/static/", import.meta.url), { recursive: true })

process.env.PORT = "3100"
process.env.HOSTNAME = "127.0.0.1"
await import(new URL("../.next/standalone/server.js", import.meta.url).href)
