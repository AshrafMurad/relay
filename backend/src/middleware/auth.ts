import type { PrismaClient, User } from "@prisma/client";
import type { RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";
import { getSessionByToken, SESSION_COOKIE_NAME } from "../modules/auth/auth.service.js";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: User;
    sessionToken?: string;
  }
}

export function createAuthMiddleware(prisma: PrismaClient): RequestHandler {
  return async (request, _response, next) => {
    try {
      const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
      const session = await getSessionByToken(prisma, token);
      if (session) {
        request.authUser = session.user;
        request.sessionToken = token;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth: RequestHandler = (request, _response, next) => {
  if (!request.authUser) {
    next(new ApiError(401, "UNAUTHORIZED", "Authentication is required."));
    return;
  }
  next();
};
