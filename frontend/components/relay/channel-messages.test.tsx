import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { AuthUserDTO, ChannelDTO, MessageDTO } from "@/lib/api/contracts"
import { apiRequest } from "@/lib/api/client"

import { ChannelMessages } from "./channel-messages"

vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }))

const user: AuthUserDTO = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada Lovelace",
  image: null,
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

function channel(archived: boolean): ChannelDTO {
  return {
    id: archived ? "channel-archived" : "channel-active",
    workspaceId: "workspace-1",
    name: archived ? "history" : "general",
    description: null,
    createdById: "user-1",
    archivedAt: archived ? "2026-02-01T00:00:00.000Z" : null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function message(id: string, content: string, createdAt: string): MessageDTO {
  return {
    id,
    workspaceId: "workspace-1",
    channelId: "channel-active",
    operationId: `operation-${id}`,
    author: { id: "user-1", name: "Ada Lovelace", image: null },
    content,
    parentMessageId: null,
    parent: null,
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ChannelMessages", () => {
  it("renders canonical history oldest first and provides a composer", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      messages: [
        message("newer", "Second message", "2026-01-02T00:00:00.000Z"),
        message("older", "First message", "2026-01-01T00:00:00.000Z"),
      ],
      nextCursor: null,
      hasMore: false,
    })

    render(<ChannelMessages channel={channel(false)} user={user} />)

    const log = await screen.findByRole("log", { name: "Message history for general" })
    await waitFor(() => expect(log.textContent?.indexOf("First message")).toBeLessThan(log.textContent?.indexOf("Second message") ?? 0))
    expect(screen.getByPlaceholderText("Message #general")).toBeTruthy()
  })

  it("keeps archived history readable without rendering write controls", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ messages: [], nextCursor: null, hasMore: false })

    render(<ChannelMessages channel={channel(true)} user={user} />)

    expect(await screen.findByText(/history remains available/i)).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
  })
})
