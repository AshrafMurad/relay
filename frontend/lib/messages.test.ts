import { describe, expect, it } from "vitest"

import type { MessageDTO } from "./api/contracts"
import { createOptimisticMessage, mergeMessages, reconcileMessageUpdate, validateMessageContent } from "./messages"

function message(id: string, operationId: string, createdAt = "2026-01-01T00:00:00.000Z"): MessageDTO {
  return {
    id,
    operationId,
    workspaceId: "workspace-1",
    channelId: "channel-1",
    author: { id: "user-1", name: "Ada", image: null },
    content: id,
    parentMessageId: null,
    parent: null,
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

describe("message content validation", () => {
  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(validateMessageContent("😀".repeat(4_000)).success).toBe(true)
    expect(validateMessageContent("😀".repeat(4_001))).toMatchObject({ success: false, codePoints: 4_001 })
  })

  it("trims content and rejects whitespace-only messages", () => {
    expect(validateMessageContent("  hello\n")).toMatchObject({ success: true, content: "hello" })
    expect(validateMessageContent(" \n\t ")).toMatchObject({ success: false, codePoints: 0 })
  })
})

describe("message reconciliation", () => {
  it("replaces an optimistic temporary ID by operation ID without duplicating it", () => {
    const optimistic = createOptimisticMessage({
      channelId: "channel-1",
      content: "hello",
      operationId: "operation-1",
      parent: null,
      temporaryId: "temporary-1",
      user: { id: "user-1", email: "ada@example.com", name: "Ada", image: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z" },
      workspaceId: "workspace-1",
    })
    const canonical = message("canonical-1", "operation-1")

    expect(mergeMessages([optimistic], [canonical])).toEqual([canonical])
  })

  it("deduplicates overlapping pages and orders messages oldest first", () => {
    const newer = message("message-2", "operation-2", "2026-01-02T00:00:00.000Z")
    const older = message("message-1", "operation-1", "2026-01-01T00:00:00.000Z")

    expect(mergeMessages([newer], [newer, older]).map((item) => item.id)).toEqual(["message-1", "message-2"])
  })

  it("reconciles edited and deleted parents embedded in loaded replies", () => {
    const parent = message("parent", "operation-parent")
    const reply: MessageDTO = {
      ...message("reply", "operation-reply", "2026-01-02T00:00:00.000Z"),
      parentMessageId: parent.id,
      parent: { id: parent.id, authorName: parent.author.name, content: parent.content, deletedAt: null },
    }
    const edited = { ...parent, content: "Edited parent", editedAt: "2026-01-03T00:00:00.000Z" }
    const afterEdit = reconcileMessageUpdate([parent, reply], edited)

    expect(afterEdit.find((item) => item.id === "reply")?.parent).toMatchObject({ content: "Edited parent", deletedAt: null })

    const deleted = { ...edited, content: "", deletedAt: "2026-01-04T00:00:00.000Z" }
    expect(reconcileMessageUpdate(afterEdit, deleted).find((item) => item.id === "reply")?.parent).toMatchObject({
      content: "",
      deletedAt: "2026-01-04T00:00:00.000Z",
    })
  })
})
