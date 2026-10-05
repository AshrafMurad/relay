import { describe, expect, it } from "vitest"

import { canManageChannels, channelNameSchema } from "./channels"

describe("channel UI rules", () => {
  it("mirrors the backend role matrix", () => {
    expect(canManageChannels("OWNER")).toBe(true)
    expect(canManageChannels("ADMIN")).toBe(true)
    expect(canManageChannels("MEMBER")).toBe(false)
  })

  it.each(["general", "release-notes", "team_updates", "a2"])("accepts %s", (name) => {
    expect(channelNameSchema.safeParse(name).success).toBe(true)
  })

  it.each(["a", "Uppercase", "two words", "bad!name"])("rejects %s", (name) => {
    expect(channelNameSchema.safeParse(name).success).toBe(false)
  })
})
