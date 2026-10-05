import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import type { PrismaClient, Session, User } from "@prisma/client";

import { ApiError } from "../../lib/api-error.js";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE_NAME = "relay_session";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;

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

async function hashPassword(password: string) {
  const salt = createToken(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("base64url")}`;
}

async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [scheme, salt, expected] = encoded.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "base64url");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

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

  return { user: toAuthUserDTO(user) };
}

export async function verifyEmail(prisma: PrismaClient, token: string) {
  const verification = await prisma.verification.findUnique({ where: { valueHash: hashToken(token) } });
  if (!verification || verification.expiresAt <= new Date() || !verification.identifier.startsWith("email:")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Email verification link is invalid or expired.");
  }
  const email = verification.identifier.slice("email:".length);

  const user = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({ where: { email }, data: { emailVerified: true } });
    await transaction.verification.delete({ where: { id: verification.id } });
    return updated;
  });

  return toAuthUserDTO(user);
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
  if (!account || !(await verifyPassword(input.password, account.password))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  const { token } = await createSession(prisma, account.userId, requestMeta);
  return { token, user: toAuthUserDTO(account.user) };
}

export async function getSessionByToken(prisma: PrismaClient, token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session as Session & { user: User };
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
