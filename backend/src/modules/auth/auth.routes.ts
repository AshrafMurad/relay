import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import type { Environment } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { createRequestRateLimit } from "../../middleware/rate-limit.js";
import { createUserRateLimit } from "../../middleware/rate-limit.js";
import { MAX_IDENTITY_IMAGE_BYTES, updateUserImage } from "../identity-images/identity-image.service.js";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, sessionCookieOptions, signIn, signOut, signUp, toAuthUserDTO, SESSION_COOKIE_NAME } from "./auth.service.js";

const signUpSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  name: z.string().min(1, "Name is required.").max(120, "Name must be 120 characters or fewer."),
  password: z.string()
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`),
});

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1),
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Request body is invalid.");
  return parsed.data;
}

export function createAuthRouter(prisma: PrismaClient, environment: Pick<Environment, "NODE_ENV" | "UPLOAD_DIR">) {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IDENTITY_IMAGE_BYTES, files: 1 } });

  router.get("/me", requireAuth, (request, response) => {
    response.json({ user: toAuthUserDTO(request.authUser!) });
  });

  router.post("/me/image", requireAuth, createUserRateLimit(10, 60_000), upload.single("file"), asyncHandler(async (request, response) => {
    if (!request.file) throw new ApiError(400, "VALIDATION_ERROR", "An image file is required.");
    const user = await updateUserImage(prisma, { uploadDir: environment.UPLOAD_DIR, userId: request.authUser!.id, file: request.file });
    response.json({ user: toAuthUserDTO(user) });
  }));

  router.post("/signup", createRequestRateLimit(5, 60 * 60_000, (request) => request.ip, "RATE_LIMITED", "auth-signup"), asyncHandler(async (request, response) => {
    const input = parseBody(signUpSchema, request.body);
    const { token, user } = await signUp(prisma, input, {
      ipAddress: request.ip,
      userAgent: request.get("user-agent"),
    });
    response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(environment.NODE_ENV === "production"));
    response.status(201).json({ user });
  }));

  router.post(
    "/signin",
    createRequestRateLimit(5, 15 * 60_000, (request) => request.ip, "RATE_LIMITED", "auth-signin-ip"),
    createRequestRateLimit(5, 15 * 60_000, (request) => typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "unknown", "RATE_LIMITED", "auth-signin-email"),
    asyncHandler(async (request, response) => {
      const input = parseBody(signInSchema, request.body);
      const { token, user } = await signIn(prisma, input, {
        ipAddress: request.ip,
        userAgent: request.get("user-agent"),
      });
      response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(environment.NODE_ENV === "production"));
      response.json({ user });
    }),
  );

  router.post("/signout", asyncHandler(async (request, response) => {
    await signOut(prisma, request.sessionToken);
    response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    response.status(204).send();
  }));

  return router;
}
