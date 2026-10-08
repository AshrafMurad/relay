import type { Request, RequestHandler } from "express";

import type { ApiErrorCode } from "../contracts/api.js";
import { ApiError } from "../lib/api-error.js";

const hits = new Map<string, { timestamps: number[]; windowMs: number }>();
let requestsUntilSweep = 1_000;

export function createRequestRateLimit(limit: number, windowMs: number, keyForRequest: (request: Request) => string | undefined, code?: ApiErrorCode, scope?: string): RequestHandler;
export function createRequestRateLimit(
  limit: number,
  windowMs: number,
  keyForRequest: (request: Request) => string | undefined,
  code: ApiErrorCode = "RATE_LIMITED",
  scope: string = code,
): RequestHandler {
  return (request, _response, next) => {
    const requestKey = keyForRequest(request);
    if (!requestKey) {
      next();
      return;
    }
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `${scope}:${limit}:${windowMs}:${requestKey}`;
    const current = (hits.get(key)?.timestamps ?? []).filter((timestamp) => timestamp > windowStart);
    if (current.length >= limit) {
      next(new ApiError(429, code, "Too many requests. Please wait before retrying."));
      return;
    }
    current.push(now);
    hits.set(key, { timestamps: current, windowMs });
    requestsUntilSweep -= 1;
    if (requestsUntilSweep === 0) {
      requestsUntilSweep = 1_000;
      for (const [storedKey, entry] of hits) {
        const active = entry.timestamps.filter((timestamp) => timestamp > now - entry.windowMs);
        if (active.length === 0) hits.delete(storedKey);
        else hits.set(storedKey, { ...entry, timestamps: active });
      }
    }
    next();
  };
}

export function createUserRateLimit(limit: number, windowMs: number, code?: ApiErrorCode, scope?: string): RequestHandler;
export function createUserRateLimit(limit: number, windowMs: number, code: ApiErrorCode = "RATE_LIMITED", scope: string = code): RequestHandler {
  return createRequestRateLimit(limit, windowMs, (request) => request.authUser?.id, code, scope);
}
