import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { AuthUserDTO, ChannelDTO, MessageAckEvent, MessageDTO, MessageNewEvent, MessageSendEvent } from "@/lib/api/contracts"
import { apiRequest } from "@/lib/api/client"
import { createRelaySocket } from "@/lib/realtime/socket"

import { ChannelMessages } from "./channel-messages"

vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }))
vi.mock("@/lib/realtime/socket", () => ({ createRelaySocket: vi.fn() }))

type SocketHandlerMap = {
  connect: () => void
  disconnect: () => void
  connect_error: () => void
  "message:ack": (event: MessageAckEvent) => void
  "message:new": (event: MessageNewEvent) => void
  "message:error": (event: { operationId?: string; code: string; message: string }) => void
}

function mockSocket() {
  const handlers: Partial<SocketHandlerMap> = {}
  const sent: MessageSendEvent[] = []
  const socket = {
    connected: true,
    on: vi.fn(<TEvent extends keyof SocketHandlerMap>(event: TEvent, handler: SocketHandlerMap[TEvent]) => { handlers[event] = handler }),
    emit: vi.fn((event: string, payload: unknown, acknowledge?: (event: { ok: true }) => void) => {
      if (event === "conversation:join") acknowledge?.({ ok: true })
      if (event === "message:send") sent.push(payload as MessageSendEvent)
    }),
    disconnect: vi.fn(),
  }
  vi.mocked(createRelaySocket).mockReturnValue(socket as never)
  return { handlers, sent, socket }
}

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
    mockSocket()
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

  it("adds messages delivered by the channel socket", async () => {
    const { handlers } = mockSocket()
    vi.mocked(apiRequest).mockResolvedValue({ messages: [], nextCursor: null, hasMore: false })

    render(<ChannelMessages channel={channel(false)} user={user} />)
    await screen.findByRole("log", { name: "Message history for general" })

    handlers["message:new"]?.({
      sequence: "1",
      message: { ...message("remote", "Hello from Grace", "2026-01-03T00:00:00.000Z"), author: { id: "user-2", name: "Grace Hopper", image: null } },
    })

    expect(await screen.findByText("Hello from Grace")).toBeTruthy()
  })

  it("sends over the socket and reconciles the optimistic message from the ack", async () => {
    const userEvents = userEvent.setup()
    const { handlers, sent } = mockSocket()
    vi.mocked(apiRequest).mockResolvedValue({ messages: [], nextCursor: null, hasMore: false })

    render(<ChannelMessages channel={channel(false)} user={user} />)
    await userEvents.type(await screen.findByPlaceholderText("Message #general"), "Socket hello")
    await userEvents.click(screen.getByLabelText("Send message"))

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ workspaceId: "workspace-1", conversation: { type: "channel", id: "channel-active" }, content: "Socket hello" })
    expect(await screen.findByText("Sending...")).toBeTruthy()

    handlers["message:ack"]?.({
      operationId: sent[0]!.operationId,
      sequence: "2",
      message: { ...message("server-message", "Socket hello", "2026-01-04T00:00:00.000Z"), operationId: sent[0]!.operationId },
    })

    await waitFor(() => expect(screen.queryByText("Sending...")).toBeNull())
    expect(screen.getByText("Socket hello")).toBeTruthy()
  })
})
