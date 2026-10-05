import type { RequestHandler } from "express";

import type { ApiErrorCode } from "../contracts/api.js";
import { ApiError } from "../lib/api-error.js";

export function createUserRateLimit(limit: number, windowMs: number, code: ApiErrorCode = "RATE_LIMITED"): RequestHandler {
  const hits = new Map<string, number[]>();
  return (request, _response, next) => {
    const userId = request.authUser?.id;
    if (!userId) {
      next();
      return;
    }
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `${userId}:${request.baseUrl}:${request.route?.path ?? request.path}`;
    const current = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    if (current.length >= limit) {
      next(new ApiError(429, code, "Too many requests. Please wait before retrying."));
      return;
    }
    current.push(now);
    hits.set(key, current);
    next();
  };
}
