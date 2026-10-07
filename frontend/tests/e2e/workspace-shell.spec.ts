import { expect, test, type Page } from "@playwright/test"

const now = "2026-10-08T00:00:00.000Z"
const user = { id: "user-1", email: "mina@northstar.test", name: "Mina Chen", image: null, emailVerified: true, createdAt: now }
const workspace = { id: "workspace-1", name: "Northstar Lab", slug: "northstar", imageUrl: null, createdAt: now, updatedAt: now, currentUserRole: "OWNER" }
const channels = [
  { id: "channel-1", workspaceId: workspace.id, name: "launch-room", description: "Coordinate the next release", createdById: user.id, archivedAt: null, lastMessageAt: now, unreadCount: 0, lastReadMessageId: "message-1", createdAt: now, updatedAt: now },
  { id: "channel-2", workspaceId: workspace.id, name: "design", description: "Product design reviews", createdById: user.id, archivedAt: null, lastMessageAt: now, unreadCount: 3, lastReadMessageId: null, createdAt: now, updatedAt: now },
]
const members = [
  { id: "member-1", userId: user.id, email: user.email, name: user.name, image: null, role: "OWNER", joinedAt: now },
  { id: "member-2", userId: "user-2", email: "owen@northstar.test", name: "Owen Park", image: null, role: "MEMBER", joinedAt: now },
]
const conversations = [
  { id: "dm-1", workspaceId: workspace.id, participantKey: "user-1:user-2", otherUser: { id: "user-2", name: "Owen Park", email: "owen@northstar.test", image: null }, lastMessageAt: now, unreadCount: 1, lastReadMessageId: null, createdAt: now, updatedAt: now },
]
const messages = [
  { id: "message-1", workspaceId: workspace.id, channelId: "channel-1", directConversationId: null, operationId: "operation-1", author: { id: "user-2", name: "Owen Park", image: null }, content: "The reconnect check passed. Release notes are ready for review.", parentMessageId: null, parent: null, attachments: [], reactions: [{ emoji: "✅", count: 2, reactedByMe: false }], editedAt: null, deletedAt: null, createdAt: now, updatedAt: now },
]

async function mockWorkspaceApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api/, "")
    let body: unknown
    if (path === "/auth/me") body = { user }
    else if (path === "/workspaces") body = { workspaces: [workspace] }
    else if (path === `/workspaces/${workspace.id}/channels`) body = { channels }
    else if (path === `/workspaces/${workspace.id}/members`) body = { members }
    else if (path === `/workspaces/${workspace.id}/direct-conversations`) body = { conversations }
    else if (path === "/channels/channel-1/messages") body = { messages, nextCursor: null, hasMore: false }
    else if (path === "/channels/channel-1/read") body = { readState: { workspaceId: workspace.id, conversation: { type: "channel", id: "channel-1" }, userId: user.id, lastReadMessageId: "message-1", lastReadAt: now } }
    else body = { error: { code: "NOT_FOUND", message: `Unhandled test route: ${path}` } }
    await route.fulfill({ contentType: "application/json", status: path.startsWith("/unknown") ? 404 : 200, body: JSON.stringify(body) })
  })
}

test.beforeEach(async ({ page }) => {
  await mockWorkspaceApi(page)
})

test("keeps workspace routing and shell actions legible in both themes", async ({ page }, testInfo) => {
  await page.goto("/app/northstar/channels/channel-1")

  await expect(page.getByRole("heading", { name: "launch-room" })).toBeVisible()
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByRole("button", { name: "Open navigation" }).click()
    await expect(page.getByText("Mina Chen").last()).toBeVisible()
  }
  await expect(page.getByRole("navigation", { name: "Channels" }).getByRole("link", { name: "launch-room" })).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("link", { name: "Search messages" }).last()).toBeVisible()
  await expect(page.getByText("The reconnect check passed.")).toBeVisible()

  await page.getByRole("button", { name: "Use light theme" }).last().click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
  await expect(page.getByRole("button", { name: "Use dark theme" }).last()).toBeVisible()

  if (process.env.CAPTURE_SHELL) {
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("workspace-shell-light.png") })
    await page.getByRole("button", { name: "Use dark theme" }).last().click()
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("workspace-shell-dark.png") })
  }
})
