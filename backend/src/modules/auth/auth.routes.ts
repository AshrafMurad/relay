import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import type { Environment } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { sessionCookieOptions, signIn, signOut, signUp, toAuthUserDTO, verifyEmail, SESSION_COOKIE_NAME } from "./auth.service.js";

const signUpSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(12).max(128),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({ token: z.string().min(16) });

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Request body is invalid.");
  return parsed.data;
}

export function createAuthRouter(prisma: PrismaClient, environment: Pick<Environment, "NODE_ENV">) {
  const router = Router();

  router.get("/me", requireAuth, (request, response) => {
    response.json({ user: toAuthUserDTO(request.authUser!) });
  });

  router.post("/signup", asyncHandler(async (request, response) => {
    const input = parseBody(signUpSchema, request.body);
    const result = await signUp(prisma, input);
    response.status(201).json(result);
  }));

  router.post("/verify-email", asyncHandler(async (request, response) => {
    const { token } = parseBody(verifyEmailSchema, request.body);
    const user = await verifyEmail(prisma, token);
    response.json({ user });
  }));

  router.post("/signin", asyncHandler(async (request, response) => {
    const input = parseBody(signInSchema, request.body);
    const { token, user } = await signIn(prisma, input, {
      ipAddress: request.ip,
      userAgent: request.get("user-agent"),
    });
    response.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions(environment.NODE_ENV === "production"));
    response.json({ user });
  }));

  router.post("/signout", asyncHandler(async (request, response) => {
    await signOut(prisma, request.sessionToken);
    response.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    response.status(204).send();
  }));

  router.all("/google", (_request, _response, next) => {
    next(new ApiError(503, "SERVICE_UNAVAILABLE", "Google OAuth adapter is not configured in this Sprint 1 build."));
  });

  return router;
}
