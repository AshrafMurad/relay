import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PublicSessionProvider } from "@/components/relay/public-session-provider"
import { apiRequest } from "@/lib/api/client"

import { InvitationPage } from "./invitation-page"

const replace = vi.fn()

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), replace }) }))
vi.mock("@/lib/api/client", () => {
  return { apiRequest: vi.fn() }
})

const preview = {
  workspaceName: "Relay Test",
  emailHint: "te***@example.com",
  role: "MEMBER" as const,
  status: "PENDING" as const,
  expiresAt: "2026-12-01T00:00:00.000Z",
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe("InvitationPage", () => {
  it("preserves the invitation destination for signed-out users", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ invitation: preview })

    render(<PublicSessionProvider initialUser={null}><InvitationPage token="invite-token" /></PublicSessionProvider>)

    expect(await screen.findByRole("heading", { name: "Join Relay Test" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /create account/i }).getAttribute("href")).toContain(encodeURIComponent("/invite/invite-token"))
    expect(screen.getByRole("button", { name: /log in/i }).getAttribute("href")).toContain(encodeURIComponent("/invite/invite-token"))
  })

  it("accepts the invitation and enters the workspace", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ invitation: preview })
      .mockResolvedValueOnce({ invitation: {}, workspace: { slug: "relay-test" } })

    render(<PublicSessionProvider initialUser={{ id: "user-1", email: "test@example.com", name: "Test", image: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z" }}><InvitationPage token="invite-token" /></PublicSessionProvider>)
    await userEvent.click(await screen.findByRole("button", { name: "Join Relay Test" }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/relay-test"))
    expect(window.localStorage.getItem("relay:last-workspace")).toBe("relay-test")
  })
})
