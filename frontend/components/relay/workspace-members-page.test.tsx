import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { apiRequest } from "@/lib/api/client"
import type { WorkspaceDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"

import { WorkspaceMembersPage } from "./workspace-members-page"

vi.mock("@/lib/api/client", async () => {
  class ApiClientError extends Error {}
  return { ApiClientError, apiRequest: vi.fn() }
})

const workspace: WorkspaceDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Relay Team",
  slug: "relay-team",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  currentUserRole: "OWNER",
}

const members: WorkspaceMemberDTO[] = [
  { id: "22222222-2222-4222-8222-222222222222", userId: "owner", email: "owner@relay.test", name: "Owner", image: null, role: "OWNER", joinedAt: "2026-01-01T00:00:00.000Z" },
  { id: "33333333-3333-4333-8333-333333333333", userId: "member", email: "member@relay.test", name: "Grace Hopper", image: null, role: "MEMBER", joinedAt: "2026-01-02T00:00:00.000Z" },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("WorkspaceMembersPage", () => {
  it("requires dialog confirmation before removing a member", async () => {
    const user = userEvent.setup()
    vi.mocked(apiRequest).mockImplementation((path, init) => {
      if (path === "/workspaces") return Promise.resolve({ workspaces: [workspace] }) as never
      if (path.endsWith("/members") && !init?.method) return Promise.resolve({ members }) as never
      if (path.endsWith("/invitations")) return Promise.resolve({ invitations: [] }) as never
      if (path.endsWith(members[1]!.id) && init?.method === "DELETE") return Promise.resolve(undefined) as never
      throw new Error(`Unexpected request: ${path}`)
    })

    render(<WorkspaceMembersPage workspaceSlug="relay-team" />)
    await screen.findByText("Grace Hopper")
    await user.click(screen.getByLabelText("Remove Grace Hopper"))

    expect(await screen.findByRole("dialog", { name: "Remove Grace Hopper?" })).toBeTruthy()
    expect(apiRequest).not.toHaveBeenCalledWith(expect.stringContaining(members[1]!.id), expect.objectContaining({ method: "DELETE" }))
    await user.click(screen.getByRole("button", { name: "Remove member" }))
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/workspaces/${workspace.id}/members/${members[1]!.id}`, { method: "DELETE" }))
    await waitFor(() => expect(screen.queryByText("Grace Hopper")).toBeNull())
  })
})
