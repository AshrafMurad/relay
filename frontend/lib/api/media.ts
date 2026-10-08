import { API_BASE_URL } from "./client"

export function mediaUrl(value: string | null | undefined) {
  if (!value) return null
  if (value.startsWith("/api/")) return `${API_BASE_URL}${value}`
  return value
}
