import type { Request, RequestHandler } from "express";

import type { ApiErrorCode } from "../contracts/api.js";
import { ApiError } from "../lib/api-error.js";
import { defaultRateLimiter, type RateLimiter } from "../lib/rate-limiter.js";

declare module "express-serve-static-core" {
  interface Request {
    rateLimiter?: RateLimiter;
  }
}

export function createRequestRateLimit(limit: number, windowMs: number, keyForRequest: (request: Request) => string | undefined, code?: ApiErrorCode, scope?: string): RequestHandler;
export function createRequestRateLimit(
  limit: number,
  windowMs: number,
  keyForRequest: (request: Request) => string | undefined,
  code: ApiErrorCode = "RATE_LIMITED",
  scope: string = code,
): RequestHandler {
  return async (request, response, next) => {
    const requestKey = keyForRequest(request);
    if (!requestKey) {
      next();
      return;
    }
    const result = await (request.rateLimiter ?? defaultRateLimiter).consume(scope, requestKey, limit, windowMs);
    if (!result.allowed) {
      response.setHeader("retry-after", Math.ceil(result.retryAfterMs / 1_000));
      next(new ApiError(429, code, "Too many requests. Please wait before retrying."));
      return;
    }
    next();
  };
}

export function createUserRateLimit(limit: number, windowMs: number, code?: ApiErrorCode, scope?: string): RequestHandler;
export function createUserRateLimit(limit: number, windowMs: number, code: ApiErrorCode = "RATE_LIMITED", scope: string = code): RequestHandler {
  return createRequestRateLimit(limit, windowMs, (request) => request.authUser?.id, code, scope);
}
