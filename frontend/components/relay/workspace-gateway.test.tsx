import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiRequest } from "@/lib/api/client"

import { WorkspaceGateway } from "./workspace-gateway"

const replace = vi.fn()
const push = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }))
vi.mock("@/lib/api/client", () => {
  class MockApiClientError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message)
    }
  }
  return { ApiClientError: MockApiClientError, apiRequest: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe("WorkspaceGateway", () => {
  it("offers create and join actions when the user has no memberships", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ user: { id: "user-1", email: "test@example.com", name: "Test", image: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z" } })
      .mockResolvedValueOnce({ workspaces: [] })

    render(<WorkspaceGateway />)

    expect(await screen.findByRole("heading", { name: "Create a workspace" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Join with an invitation" })).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it("enters the only workspace without showing a chooser", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ user: { id: "user-1", email: "test@example.com", name: "Test", image: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z" } })
      .mockResolvedValueOnce({ workspaces: [{ id: "workspace-1", name: "Relay", slug: "relay", imageUrl: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", currentUserRole: "MEMBER" }] })

    render(<WorkspaceGateway />)

    await screen.findByText("Routing your workspace")
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/app/relay"))
  })

  it("keeps a large workspace list searchable while create and join actions remain visible", async () => {
    const workspaces = Array.from({ length: 8 }, (_, index) => ({
      id: `workspace-${index + 1}`,
      name: index === 7 ? "Research Lab" : `Product Team ${index + 1}`,
      slug: index === 7 ? "research-lab" : `product-team-${index + 1}`,
      imageUrl: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      currentUserRole: "MEMBER" as const,
    }))
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ user: { id: "user-1", email: "test@example.com", name: "Test", image: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z" } })
      .mockResolvedValueOnce({ workspaces })

    render(<WorkspaceGateway forceChoose />)

    const search = await screen.findByRole("searchbox", { name: "Find a workspace" })
    expect(screen.getByText("8 total")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Create a workspace" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Join with an invitation" })).toBeTruthy()

    await userEvent.type(search, "Research")

    expect(screen.getByRole("link", { name: /Research Lab/ })).toBeTruthy()
    expect(screen.queryByRole("link", { name: /Product Team 1/ })).toBeNull()
  })
})
