import { cleanup, render, screen } from "@testing-library/react"
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
})
