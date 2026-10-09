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
const conversations = ["Owen Park", "Ava Stone", "Iris Hayes", "Sam Okafor", "Jules Rivera", "Leo Brooks", "Nora Patel"].map((name, index) => ({
  id: `dm-${index + 1}`,
  workspaceId: workspace.id,
  participantKey: `user-1:user-${index + 2}`,
  otherUser: { id: `user-${index + 2}`, name, email: `${name.toLowerCase().replace(" ", ".")}@northstar.test`, image: null },
  lastMessageAt: now,
  unreadCount: index === 0 ? 1 : 0,
  lastReadMessageId: null,
  createdAt: now,
  updatedAt: now,
}))
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
    else if (path === `/workspaces/${workspace.id}/sync`) body = { events: [], nextCursor: "checkpoint", hasMore: false, resetRequired: false }
    else if (path === "/channels/channel-1/messages") body = { messages, nextCursor: null, hasMore: false }
    else if (path === "/channels/channel-1/read") body = { readState: { workspaceId: workspace.id, conversation: { type: "channel", id: "channel-1" }, userId: user.id, lastReadMessageId: "message-1", lastReadAt: now } }
    else body = { error: { code: "NOT_FOUND" } }
    await route.fulfill({ contentType: "application/json", status: body && typeof body === "object" && "error" in body ? 404 : 200, body: JSON.stringify(body) })
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

  await page.getByRole("button", { name: /Mina Chen.*mina@northstar.test/ }).last().click()
  await page.getByRole("button", { name: "Use light theme" }).last().click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
  await expect(page.getByRole("button", { name: "Use dark theme" }).last()).toBeVisible()

  await page.keyboard.press("Escape")
  if (testInfo.project.name === "mobile-chrome") await page.keyboard.press("Escape")
  await expect(page.getByRole("link", { name: "Search messages" })).toBeVisible()
  await expect(page.getByText("The reconnect check passed. Release notes are ready for review.")).toBeVisible()

  if (process.env.CAPTURE_SHELL) {
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("workspace-shell-light.png") })
    if (testInfo.project.name === "mobile-chrome") await page.getByRole("button", { name: "Open navigation" }).click()
    await page.getByRole("button", { name: /Mina Chen.*mina@northstar.test/ }).last().click()
    await page.getByRole("button", { name: "Use dark theme" }).last().click()
    await page.keyboard.press("Escape")
    if (testInfo.project.name === "mobile-chrome") await page.keyboard.press("Escape")
    await page.screenshot({ fullPage: true, path: testInfo.outputPath("workspace-shell-dark.png") })
  }
})

test("keeps shell chrome visible in a short desktop viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop viewport regression")
  await page.setViewportSize({ width: 1920, height: 420 })
  await page.goto("/app/northstar/channels/channel-1")

  const header = page.getByRole("heading", { name: "launch-room" })
  const composer = page.getByPlaceholder("Message #launch-room")
  const profileAction = page.getByRole("button", { name: /Mina Chen.*mina@northstar.test/ })
  const sendAction = page.getByRole("button", { name: "Send message" })

  await expect(header).toBeVisible()
  await expect(composer).toBeVisible()
  await expect(profileAction).toBeVisible()
  await expect(sendAction).toBeVisible()

  const navigationScrolls = await page.getByRole("navigation", { name: "Direct messages" }).evaluate((element) => {
    let parent = element.parentElement
    while (parent && !["auto", "scroll"].includes(getComputedStyle(parent).overflowY)) parent = parent.parentElement
    return Boolean(parent && parent.scrollHeight > parent.clientHeight)
  })
  expect(navigationScrolls).toBe(true)

  for (const element of [header, composer, profileAction, sendAction]) {
    const box = await element.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(420)
  }
})
