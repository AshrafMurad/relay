import { z } from "zod"

export const channelNameSchema = z.string().regex(
  /^[a-z0-9_-]{2,80}$/,
  "Use 2 to 80 lowercase letters, numbers, hyphens, or underscores.",
)

export function canManageChannels(role: "OWNER" | "ADMIN" | "MEMBER") {
  return role === "OWNER" || role === "ADMIN"
}
