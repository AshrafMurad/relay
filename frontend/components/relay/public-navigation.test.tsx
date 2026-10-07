import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { apiRequest } from "@/lib/api/client"

import { PublicNavigation } from "./public-navigation"
import { PublicSessionProvider } from "./public-session-provider"

const refresh = vi.fn()
let pathname = "/"
let query = new URLSearchParams()

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh }),
  useSearchParams: () => query,
}))
vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }))

beforeEach(() => {
  pathname = "/"
  query = new URLSearchParams()
  document.documentElement.classList.add("dark")
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("PublicNavigation", () => {
  it("renders one anonymous navigation and preserves invitation destinations", () => {
    pathname = "/invite/invite-token"
    render(<PublicSessionProvider initialUser={null}><PublicNavigation /></PublicSessionProvider>)

    const navigation = screen.getByRole("navigation", { name: "Public navigation" })
    expect(within(navigation).getByRole("link", { name: "Log in" }).getAttribute("href")).toContain(encodeURIComponent("/invite/invite-token"))
    expect(within(navigation).getByRole("link", { name: "Sign up" }).getAttribute("href")).toContain(encodeURIComponent("/invite/invite-token"))
  })

  it("marks the active auth destination while retaining a safe next path", () => {
    pathname = "/login"
    query = new URLSearchParams({ next: "/app/relay-test" })
    render(<PublicSessionProvider initialUser={null}><PublicNavigation /></PublicSessionProvider>)

    const login = screen.getByRole("link", { name: "Log in" })
    expect(login.getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toContain(encodeURIComponent("/app/relay-test"))
  })

  it("renders authenticated actions and signs out without a stale navigation state", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(undefined)
    render(
      <PublicSessionProvider initialUser={{ id: "user-1", email: "test@example.com", name: "Test", image: null, emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z" }}>
        <PublicNavigation />
      </PublicSessionProvider>,
    )

    expect(screen.getByRole("link", { name: "Open Relay" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Use another account" }))
    expect(apiRequest).toHaveBeenCalledWith("/auth/signout", { method: "POST" })
    expect(screen.getByRole("link", { name: "Log in" })).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
  })

  it("uses the shared persistent theme control", async () => {
    render(<PublicSessionProvider initialUser={null}><PublicNavigation /></PublicSessionProvider>)

    await userEvent.click(screen.getByRole("button", { name: "Use light theme" }))
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe("light")
    expect(window.localStorage.getItem("relay:theme")).toBe("light")
  })
})
