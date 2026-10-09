import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import type { PrismaClient, Session, User } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";

const SESSION_COOKIE_NAME = "relay_session";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

// Explicit cost profile. The encoding format stays unchanged because these are
// also Node's scrypt defaults; pinning them prevents silent drift and makes the
// hash scheme auditable.
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export { SESSION_COOKIE_NAME };

export interface AuthUserDTO {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthSessionDTO {
  user: AuthUserDTO;
}

export function toAuthUserDTO(user: User): AuthUserDTO {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

function deriveScrypt(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

async function hashPassword(password: string) {
  const salt = createToken(16);
  return `scrypt:${salt}:${(await deriveScrypt(password, salt)).toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [scheme, salt, expected] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = await deriveScrypt(password, salt);
  const expectedBuffer = Buffer.from(expected, "base64url");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

// A throwaway derivation so unknown accounts pay the same password-verification
// cost as known ones, without exposing which branch executed. The catch keeps a
// failed startup derivation from surfacing as an unhandled rejection.
const dummyVerificationTarget = hashPassword(createToken()).catch(() => "scrypt::");

async function createSession(
  prisma: PrismaClient,
  userId: string,
  requestMeta: { ipAddress?: string; userAgent?: string },
) {
  const token = createToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    },
  });
  return { token, session };
}

export async function signUp(
  prisma: PrismaClient,
  input: { email: string; name: string; password: string },
  requestMeta: { ipAddress?: string; userAgent?: string },
) {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  if (input.password.length < PASSWORD_MIN_LENGTH || input.password.length > PASSWORD_MAX_LENGTH) {
    throw new ApiError(400, "VALIDATION_ERROR", `Password must contain ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`);
  }
  if (!name) throw new ApiError(400, "VALIDATION_ERROR", "Name is required.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(400, "VALIDATION_ERROR", "An account already exists for this email.");

  const user = await prisma.$transaction(async (transaction) => {
    const createdUser = await transaction.user.create({ data: { email, name, emailVerified: true } });
    await transaction.account.create({
      data: {
        userId: createdUser.id,
        providerId: "credential",
        accountId: email,
        password: await hashPassword(input.password),
      },
    });
    return createdUser;
  });

  const { token } = await createSession(prisma, user.id, requestMeta);
  return { token, user: toAuthUserDTO(user) };
}

export async function signIn(
  prisma: PrismaClient,
  input: { email: string; password: string },
  requestMeta: { ipAddress?: string; userAgent?: string },
) {
  const email = normalizeEmail(input.email);
  const account = await prisma.account.findUnique({
    where: { providerId_accountId: { providerId: "credential", accountId: email } },
    include: { user: true },
  });
  if (!account) {
    await dummyVerificationTarget.then((encoded) => verifyPassword(input.password, encoded));
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  if (!(await verifyPassword(input.password, account.password))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  const { token } = await createSession(prisma, account.userId, requestMeta);
  return { token, user: toAuthUserDTO(account.user) };
}

export async function getSessionByToken(prisma: PrismaClient, token: string | undefined, refresh = false) {
  if (!token) return null;
  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= now) return null;
  let refreshed = false;
  if (refresh && session.updatedAt <= new Date(now.getTime() - SESSION_REFRESH_INTERVAL_MS)) {
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
    const result = await prisma.session.updateMany({
      where: { id: session.id, expiresAt: { gt: now }, updatedAt: { lte: new Date(now.getTime() - SESSION_REFRESH_INTERVAL_MS) } },
      data: { expiresAt },
    });
    if (result.count === 1) {
      session.expiresAt = expiresAt;
      refreshed = true;
    }
  }
  return Object.assign(session as Session & { user: User }, { refreshed });
}

export async function signOut(prisma: PrismaClient, token: string | undefined) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function sessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_LIFETIME_MS,
  };
}
