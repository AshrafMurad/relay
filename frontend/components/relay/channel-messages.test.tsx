import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthUserDTO, ChannelDTO, ConversationReadUpdateEvent, MessageAckEvent, MessageDTO, MessageNewEvent, MessageSendEvent, ReactionUpdateEvent } from "@/lib/api/contracts"
import { apiRequest } from "@/lib/api/client"
import { createRelaySocket } from "@/lib/realtime/socket"

import { ChannelMessages } from "./channel-messages"

vi.mock("@/lib/api/client", () => ({ API_BASE_URL: "http://localhost:4000/api", apiRequest: vi.fn() }))
vi.mock("@/lib/realtime/socket", () => ({ createRelaySocket: vi.fn() }))

type SocketHandlerMap = {
  connect: () => void
  disconnect: () => void
  connect_error: () => void
  "message:ack": (event: MessageAckEvent) => void
  "message:new": (event: MessageNewEvent) => void
  "message:error": (event: { operationId?: string; code: string; message: string }) => void
  "reaction:update": (event: ReactionUpdateEvent) => void
  "conversation:read:update": (event: ConversationReadUpdateEvent) => void
  "typing:update": () => void
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
    lastMessageAt: null,
    unreadCount: 0,
    lastReadMessageId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function message(id: string, content: string, createdAt: string): MessageDTO {
  return {
    id,
    workspaceId: "workspace-1",
    channelId: "channel-active",
    directConversationId: null,
    operationId: `operation-${id}`,
    author: { id: "user-1", name: "Ada Lovelace", image: null },
    content,
    parentMessageId: null,
    parent: null,
    attachments: [],
    reactions: [],
    editedAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

function mockMessageHistory(messages: MessageDTO[] = []) {
  vi.mocked(apiRequest).mockImplementation((path) => {
    if (typeof path === "string" && path.includes("/sync")) return Promise.resolve({ events: [], nextCursor: "0", hasMore: false }) as never
    return Promise.resolve({ messages, nextCursor: null, hasMore: false }) as never
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.clearAllMocks()
})

describe("ChannelMessages", () => {
  it("renders canonical history oldest first and provides a composer", async () => {
    mockSocket()
    mockMessageHistory([
      message("newer", "Second message", "2026-01-02T00:00:00.000Z"),
      message("older", "First message", "2026-01-01T00:00:00.000Z"),
    ])

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)

    const log = await screen.findByRole("log", { name: "Message history for #general" })
    await waitFor(() => expect(log.textContent?.indexOf("First message")).toBeLessThan(log.textContent?.indexOf("Second message") ?? 0))
    expect(screen.getByPlaceholderText("Message #general")).toBeTruthy()
  })

  it("keeps archived history readable without rendering write controls", async () => {
    mockMessageHistory()

    render(<ChannelMessages target={{ type: "channel", channel: channel(true) }} user={user} />)

    expect(await screen.findByText(/history remains available/i)).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
  })

  it("inserts an emoji selected from the composer palette", async () => {
    const userEvents = userEvent.setup()
    mockSocket()
    mockMessageHistory()

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)
    const composer = await screen.findByPlaceholderText("Message #general")
    await userEvents.click(screen.getByLabelText("Add emoji"))
    await userEvents.click(screen.getByRole("button", { name: "Rocket" }))

    expect((composer as HTMLTextAreaElement).value).toBe("🚀")
  })

  it("inserts a mention trigger at the composer cursor", async () => {
    const userEvents = userEvent.setup()
    mockSocket()
    mockMessageHistory()

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)
    const composer = await screen.findByPlaceholderText("Message #general") as HTMLTextAreaElement
    await userEvents.type(composer, "Hello world")
    composer.setSelectionRange(5, 5)
    const mentionButton = screen.getByLabelText("Mention someone, coming soon")
    await userEvents.hover(mentionButton)
    expect(await screen.findByText("Mentions coming soon")).toBeTruthy()
    await userEvents.click(mentionButton)

    await waitFor(() => expect(composer.value).toBe("Hello @ world"))
    expect(composer.selectionStart).toBe(7)
  })

  it("adds messages delivered by the channel socket", async () => {
    const { handlers } = mockSocket()
    mockMessageHistory()

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)
    await screen.findByRole("log", { name: "Message history for #general" })

    handlers["message:new"]?.({
      sequence: "1",
      message: { ...message("remote", "Hello from Grace", "2026-01-03T00:00:00.000Z"), author: { id: "user-2", name: "Grace Hopper", image: null } },
    })

    expect(await screen.findByText("Hello from Grace")).toBeTruthy()
  })

  it("sends over the socket and reconciles the optimistic message from the ack", async () => {
    const userEvents = userEvent.setup()
    const { handlers, sent } = mockSocket()
    mockMessageHistory()

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)
    await userEvents.type(await screen.findByPlaceholderText("Message #general"), "Socket hello")
    await userEvents.click(screen.getByLabelText("Send message"))

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ workspaceId: "workspace-1", conversation: { type: "channel", id: "channel-active" }, content: "Socket hello" })
    expect(await screen.findByText("Queued for delivery")).toBeTruthy()

    handlers["message:ack"]?.({
      operationId: sent[0]!.operationId,
      sequence: "2",
      message: { ...message("server-message", "Socket hello", "2026-01-04T00:00:00.000Z"), operationId: sent[0]!.operationId },
    })

    await waitFor(() => expect(screen.queryByText("Queued for delivery")).toBeNull())
    expect(screen.getByText("Socket hello")).toBeTruthy()
  })

  it("uploads multiple files and sends them in one attachment-only message", async () => {
    const userEvents = userEvent.setup()
    const { sent } = mockSocket()
    const attachmentResponses = [
      {
        attachment: {
          id: "11111111-1111-4111-8111-111111111111",
          workspaceId: "workspace-1",
          originalFilename: "notes.txt",
          mimeType: "text/plain",
          sizeBytes: 12,
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      },
      {
        attachment: {
          id: "22222222-2222-4222-8222-222222222222",
          workspaceId: "workspace-1",
          originalFilename: "data.json",
          mimeType: "application/json",
          sizeBytes: 18,
          createdAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      },
    ]
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (typeof path === "string" && path.includes("/sync")) return Promise.resolve({ events: [], nextCursor: "0", hasMore: false }) as never
      if (path === "/attachments") return Promise.resolve(attachmentResponses.shift()) as never
      return Promise.resolve({ messages: [], nextCursor: null, hasMore: false }) as never
    })

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)
    await screen.findByRole("log", { name: "Message history for #general" })
    await userEvents.upload(screen.getByLabelText(/attach/i), [
      new File(["hello"], "notes.txt", { type: "text/plain" }),
      new File(["{\"ok\":true}"], "data.json", { type: "application/json" }),
    ])
    await screen.findByText("notes.txt")
    await screen.findByText("data.json")
    await userEvents.click(screen.getByLabelText("Send message"))

    expect(sent[0]).toMatchObject({ content: "", attachmentIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] })
  })

  it("recovers a missed durable message from the certified workspace cursor", async () => {
    mockSocket()
    window.localStorage.setItem("relay:sync:workspace-1", "previous-checkpoint")
    const recovered = { ...message("recovered", "Recovered after reconnect", "2026-01-05T00:00:00.000Z"), author: { id: "user-2", name: "Grace Hopper", image: null } }
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (typeof path === "string" && path.includes("/sync")) {
        return Promise.resolve({
          events: [{ sequence: "9", type: "message:new", occurredAt: recovered.createdAt, data: { message: recovered } }],
          nextCursor: "current-checkpoint",
          hasMore: false,
          resetRequired: false,
        }) as never
      }
      return Promise.resolve({ messages: [], nextCursor: null, hasMore: false }) as never
    })

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)

    expect(await screen.findByText("Recovered after reconnect")).toBeTruthy()
    expect(window.localStorage.getItem("relay:sync:workspace-1")).toBe("current-checkpoint")
  })

  it("confirms message deletion in an accessible dialog", async () => {
    const userEvents = userEvent.setup()
    mockSocket()
    const original = message("delete-me", "Remove this update", "2026-01-05T00:00:00.000Z")
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (typeof path === "string" && path.includes("/sync")) return Promise.resolve({ events: [], nextCursor: "0", hasMore: false }) as never
      if (path === "/messages/delete-me" && init?.method === "DELETE") return Promise.resolve({ message: { ...original, content: "", deletedAt: "2026-01-05T01:00:00.000Z" } }) as never
      return Promise.resolve({ messages: [original], nextCursor: null, hasMore: false }) as never
    })

    render(<ChannelMessages target={{ type: "channel", channel: channel(false) }} user={user} />)
    await screen.findByText("Remove this update")
    await userEvents.click(screen.getByLabelText("More actions for message from Ada Lovelace"))
    await userEvents.click(await screen.findByText("Delete"))

    expect(await screen.findByRole("dialog", { name: "Delete this message?" })).toBeTruthy()
    expect(apiRequest).not.toHaveBeenCalledWith("/messages/delete-me", expect.anything())
    await userEvents.click(screen.getByRole("button", { name: "Delete message" }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/messages/delete-me", { method: "DELETE" }))
    expect(await screen.findByText("This message was deleted.")).toBeTruthy()
  })
})
