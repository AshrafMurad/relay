import "dotenv/config";

import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient, type WorkspaceRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run the demo seed.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl, connectionTimeoutMillis: 5_000 }) });
const demoPassword = process.env.DEMO_PASSWORD ?? "123456";
const workspaceId = "58d22ca3-1f35-4702-8642-9222f5f34bc0";

const users: Array<{ id: string; email: string; name: string; role: WorkspaceRole; image: string }> = [
  { id: "e23ac614-dbb6-4246-ab99-ff81a78a6d12", email: "owner@example.com", name: "Maya Chen", role: "OWNER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Maya%20Chen" },
  { id: "13a94bb0-6240-44b5-a3aa-d51f7f2fb9d3", email: "admin@example.com", name: "Eli Morgan", role: "ADMIN", image: "https://api.dicebear.com/9.x/initials/svg?seed=Eli%20Morgan" },
  { id: "006d1c79-bf52-41bb-9920-5cef3265a495", email: "user@example.com", name: "Nora Patel", role: "MEMBER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Nora%20Patel" },
  { id: "b280f087-58b0-433d-bc1a-895b5b49cc43", email: "user2@example.com", name: "Leo Brooks", role: "MEMBER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Leo%20Brooks" },
  { id: "e1c043f7-3903-41dc-9993-1c473f2e1b47", email: "user3@example.com", name: "Ava Stone", role: "MEMBER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Ava%20Stone" },
  { id: "5f298ec0-f470-47c8-b32b-708a50bb1bd4", email: "user4@example.com", name: "Jules Rivera", role: "MEMBER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Jules%20Rivera" },
  { id: "fc8a4fb0-bf87-4d82-9800-4e7c9d9ab808", email: "user5@example.com", name: "Sam Okafor", role: "MEMBER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Sam%20Okafor" },
  { id: "8e061faa-f64c-489c-8474-94a4c6ac4d51", email: "user6@example.com", name: "Iris Hayes", role: "MEMBER", image: "https://api.dicebear.com/9.x/initials/svg?seed=Iris%20Hayes" },
];

const channels = ["general", "product", "engineering", "design", "support", "random"] as const;
const channelIds = new Map(channels.map((name, index) => [name, `4efc3e6f-4a56-4d60-a425-00000000000${index}`]));

const topics: Record<(typeof channels)[number], string[]> = {
  general: [
    "Weekly planning starts in 15. Bring one blocker and one thing you shipped last week.",
    "I moved the customer migration checklist into the shared project board.",
    "Reminder: Friday demo is async-friendly. Recordings are welcome if time zones are rough.",
  ],
  product: [
    "The onboarding funnel review points to invite acceptance as the biggest drop-off.",
    "Can we make the empty workspace state explain the first three actions more clearly?",
    "I updated the success metric to activation within the first two channels, not first login.",
  ],
  engineering: [
    "The reconnect path is using the sync cursor now, so socket gaps should self-heal.",
    "Prisma migration is ready for review. It keeps the read-state update monotonic.",
    "Rate-limit fallback is intentionally single-instance only and marks readiness degraded.",
  ],
  design: [
    "Dropped a tighter composer treatment in Figma with clearer attachment affordances.",
    "The sidebar density feels good on desktop but still needs a little breathing room on mobile.",
    "Unread separators should be quiet but unmistakable. I added two options for review.",
  ],
  support: [
    "Customer report: CSV uploads work, but the filename wraps awkwardly in narrow layouts.",
    "Escalation from Atlas Co: they need confirmation that archived channels remain searchable.",
    "I added three realistic support questions to the demo script for interviews.",
  ],
  random: [
    "Tiny win: the office plant survived another week on remote-team watering discipline.",
    "Anyone have a good playlist for writing release notes without sounding like a robot?",
    "Lunch poll: tacos, ramen, or the responsible salad option that nobody votes for?",
  ],
};

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
  return `scrypt:${salt}:${derived.toString("base64url")}`;
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000);
}

async function createDemoAttachment(messageId: string, uploaderId: string) {
  const uploadDir = process.env.UPLOAD_DIR ?? path.resolve("storage", "uploads");
  const storageKey = `${workspaceId}/demo-release-checklist.txt`;
  const body = "Relay demo release checklist\n- migrations applied\n- health checks green\n- two-user smoke test complete\n";
  const target = path.resolve(uploadDir, storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body, "utf8");
  await prisma.attachment.create({
    data: {
      workspaceId,
      uploaderId,
      messageId,
      originalFilename: "demo-release-checklist.txt",
      mimeType: "text/plain",
      sizeBytes: BigInt(Buffer.byteLength(body)),
      storageKey,
      status: "ATTACHED",
      attachedAt: new Date(),
    },
  });
}

async function main() {
  if (demoPassword.length < 6 || demoPassword.length > 128) {
    throw new Error("DEMO_PASSWORD must contain 6 to 128 characters.");
  }
  // Fail before recreating the demo workspace if a target email belongs to a
  // non-demo user. Never silently replace an independently created account.
  const existingUsers = await prisma.user.findMany({ where: { email: { in: users.map((user) => user.email) } } });
  for (const existing of existingUsers) {
    if (users.find((user) => user.email === existing.email)?.id !== existing.id) {
      throw new Error(`Cannot seed ${existing.email}: this email belongs to a non-demo user.`);
    }
  }
  const existingCredentials = await prisma.account.findMany({
    where: { providerId: "credential", accountId: { in: users.map((user) => user.email) } },
  });
  for (const existing of existingCredentials) {
    if (users.find((user) => user.email === existing.accountId)?.id !== existing.userId) {
      throw new Error(`Cannot seed ${existing.accountId}: these credentials belong to a non-demo user.`);
    }
  }

  await prisma.workspace.deleteMany({ where: { OR: [{ id: workspaceId }, { slug: "northstar-labs" }] } });

  for (const user of users) {
    const password = await hashPassword(demoPassword);
    await prisma.$transaction(async (transaction) => {
      await transaction.user.upsert({
        where: { id: user.id },
        update: { email: user.email, name: user.name, image: user.image, emailVerified: true },
        create: { id: user.id, email: user.email, name: user.name, image: user.image, emailVerified: true },
      });
      await transaction.account.deleteMany({
        where: { userId: user.id, providerId: "credential", accountId: { not: user.email } },
      });
      await transaction.account.upsert({
        where: { providerId_accountId: { providerId: "credential", accountId: user.email } },
        update: { userId: user.id, password },
        create: { userId: user.id, providerId: "credential", accountId: user.email, password },
      });
      await transaction.session.deleteMany({ where: { userId: user.id } });
    });
  }

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: "Northstar Labs",
      slug: "northstar-labs",
      createdById: users[0]!.id,
      members: { create: users.map((user) => ({ userId: user.id, role: user.role })) },
      channels: {
        create: channels.map((name) => ({
          id: channelIds.get(name),
          name,
          description: name === "general" ? "Company-wide updates and demo announcements" : `${name[0]!.toUpperCase()}${name.slice(1)} coordination`,
          createdById: users[0]!.id,
        })),
      },
    },
  });

  let messageNumber = 0;
  const createdByChannel = new Map<string, string[]>();
  for (const channel of channels) {
    const ids: string[] = [];
    for (let index = 0; index < 12; index += 1) {
      const author = users[(index + channels.indexOf(channel)) % users.length]!;
      const base = topics[channel][index % topics[channel].length]!;
      const message = await prisma.message.create({
        data: {
          workspaceId,
          channelId: channelIds.get(channel),
          authorId: author.id,
          operationId: randomUUID(),
          content: index === 5 ? `${base}\n\nDecision: keep the scope small, verify with two users, and document the smoke result.` : base,
          createdAt: minutesAgo(900 - messageNumber * 9),
        },
      });
      ids.push(message.id);
      messageNumber += 1;
    }
    createdByChannel.set(channel, ids);
  }

  const parentId = createdByChannel.get("engineering")![2]!;
  await prisma.message.create({
    data: {
      workspaceId,
      channelId: channelIds.get("engineering"),
      authorId: users[4]!.id,
      operationId: randomUUID(),
      parentMessageId: parentId,
      content: "Replying here so the deploy thread stays easy to scan: migrations should run before the web service rolls forward.",
      createdAt: minutesAgo(120),
    },
  });

  const edited = await prisma.message.create({
    data: {
      workspaceId,
      channelId: channelIds.get("general"),
      authorId: users[2]!.id,
      operationId: randomUUID(),
      content: "Demo workspace is ready for the portfolio walkthrough. Edited to add: use Maya and Eli for the two-user flow.",
      editedAt: minutesAgo(80),
      createdAt: minutesAgo(140),
    },
  });
  await createDemoAttachment(edited.id, users[2]!.id);

  const reactedMessageId = createdByChannel.get("design")![4]!;
  await prisma.messageReaction.createMany({
    data: [users[0]!, users[2]!, users[5]!].map((user) => ({ messageId: reactedMessageId, userId: user.id, emoji: "👍" })),
  });
  await prisma.messageReaction.createMany({
    data: [users[1]!, users[3]!].map((user) => ({ messageId: parentId, userId: user.id, emoji: "🚀" })),
  });

  const dm = await prisma.directConversation.create({
    data: {
      workspaceId,
      participantKey: [users[0]!.id, users[1]!.id].sort().join(":"),
      members: { create: [{ userId: users[0]!.id }, { userId: users[1]!.id }] },
    },
  });
  await prisma.message.createMany({
    data: [
      { workspaceId, directConversationId: dm.id, authorId: users[0]!.id, operationId: randomUUID(), content: "Can you join the production smoke test after migrations finish?", createdAt: minutesAgo(65) },
      { workspaceId, directConversationId: dm.id, authorId: users[1]!.id, operationId: randomUUID(), content: "Yes. I will use a separate browser profile and verify realtime receive plus reconnect.", createdAt: minutesAgo(61) },
    ],
  });

  const generalRead = createdByChannel.get("general")![8]!;
  await prisma.channelReadState.createMany({
    data: users.slice(0, 6).map((user) => ({ channelId: channelIds.get("general")!, userId: user.id, lastReadMessageId: generalRead })),
  });

  console.log("Seeded Northstar Labs demo workspace. Demo users share the DEMO_PASSWORD value (default documented in README).");
  console.table(users.map(({ name, email, role }) => ({ name, email, role })));
}

main()
  .catch((error: unknown) => {
    console.error("Demo seed failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
