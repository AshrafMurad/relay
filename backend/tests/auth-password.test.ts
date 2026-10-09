import type { PrismaClient, User } from "@prisma/client";

import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/lib/api-error.js";
import { signIn, signUp } from "../src/modules/auth/auth.service.js";

// Hash of "fixture-password" produced with the pre-Phase-2 encoding: Node's
// default scrypt parameters (N=16384, r=8, p=1) and a 64-byte key. Stored
// hashes must keep verifying if the pinned cost profile stays compatible.
const LEGACY_SCRYPT_HASH = "scrypt:fixture-salt:4pQaa_CKalL6Q4bPbHT4x35abAiRR9_ZKDvGYTL98TUwWrmi9sWuedtBiTajBm5b_DJ4aJcNLah11J9_4yzeow";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "mina@relay.test",
    name: "Mina Chen",
    image: null,
    emailVerified: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as User;
}

function createAuthPrisma(accountPassword: string | null | undefined) {
  const capturedHash = { value: undefined as string | undefined };
  const prisma = {
    user: {
      findUnique: vi.fn(async () => null),
    },
    account: {
      findUnique: vi.fn(async () => accountPassword === null || accountPassword === undefined
        ? null
        : { userId: "user-1", password: accountPassword, user: makeUser() }),
    },
    session: {
      create: vi.fn(async () => ({ id: "session-1", userId: "user-1", expiresAt: new Date(Date.now() + 60_000) })),
    },
    $transaction: vi.fn(async (run: (client: unknown) => Promise<unknown>) => run({
      user: {
        create: vi.fn(async () => makeUser()),
      },
      account: {
        create: vi.fn(async ({ data }: { data: { password: string } }) => {
          capturedHash.value = data.password;
          return { id: "account-1" };
        }),
      },
    })),
  };
  return { prisma: prisma as unknown as PrismaClient, capturedHash };
}

function rejection(error: unknown) {
  expect(error).toBeInstanceOf(ApiError);
  const apiError = error as ApiError;
  return { statusCode: apiError.statusCode, code: apiError.code, message: apiError.message };
}

describe("credential verification", () => {
  it("returns an identical error envelope for unknown accounts and wrong passwords", async () => {
    const known = createAuthPrisma(`scrypt:known-salt:${"a".repeat(86)}`);
    const unknown = createAuthPrisma(null);

    const unknownAccount = await signIn(unknown.prisma, { email: "ghost@relay.test", password: "correct-horse" }, {})
      .catch(rejection);
    const wrongPassword = await signIn(known.prisma, { email: "mina@relay.test", password: "wrong-password" }, {})
      .catch(rejection);

    expect(unknownAccount).toEqual({ statusCode: 401, code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
    expect(wrongPassword).toEqual(unknownAccount);
  });

  it("fails closed for malformed or foreign-scheme stored hashes", async () => {
    for (const encoded of ["", "bcrypt:$2b$12$notrelay", "scrypt:", "scrypt:missing-digest"]) {
      const { prisma } = createAuthPrisma(encoded);
      await expect(signIn(prisma, { email: "mina@relay.test", password: "any-password" }, {}))
        .rejects.toMatchObject({ statusCode: 401, code: "INVALID_CREDENTIALS" });
    }
  });

  it("still verifies hashes produced with the pre-pinning default scrypt parameters", async () => {
    const { prisma } = createAuthPrisma(LEGACY_SCRYPT_HASH);
    await expect(signIn(prisma, { email: "mina@relay.test", password: "fixture-password" }, {}))
      .resolves.toMatchObject({ user: { email: "mina@relay.test" } });
    await expect(signIn(prisma, { email: "mina@relay.test", password: "other-password" }, {}))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("round-trips a newly created credential through the pinned scrypt profile", async () => {
    const { prisma, capturedHash } = createAuthPrisma(null);
    const created = await signUp(prisma, { email: "Mina@Relay.Test", name: "Mina Chen", password: "correct-horse" }, {});
    expect(created.user.email).toBe("mina@relay.test");

    const encoded = capturedHash.value;
    expect(encoded).toMatch(/^scrypt:[A-Za-z0-9_-]{16,}:[A-Za-z0-9_-]{86}$/);
    const verifying = createAuthPrisma(encoded!);
    await expect(signIn(verifying.prisma, { email: "mina@relay.test", password: "correct-horse" }, {}))
      .resolves.toMatchObject({ user: { id: "user-1" } });
  });
});
