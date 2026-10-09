import type { RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function forbidden() {
  return new ApiError(403, "FORBIDDEN", "Cross-origin browser requests are not allowed for this action.");
}

/**
 * Defense in depth for the session cookie's SameSite=Lax protection. Browsers
 * always attach an Origin, Sec-Fetch-Site, or Referer header to unsafe
 * requests, so provably cross-origin requests are rejected. Non-browser
 * clients that send no origin evidence are not part of the CSRF threat model.
 */
export function createOriginGuard(webOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.headers.origin;
    if (origin !== undefined) {
      const value = Array.isArray(origin) ? origin[0] : origin;
      if (value !== webOrigin) {
        next(forbidden());
        return;
      }
      next();
      return;
    }

    const fetchSite = request.headers["sec-fetch-site"];
    if (typeof fetchSite === "string") {
      if (fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
        next(forbidden());
        return;
      }
      next();
      return;
    }

    const referer = request.headers.referer;
    if (typeof referer === "string" && referer.length > 0) {
      try {
        if (new URL(referer).origin !== webOrigin) {
          next(forbidden());
          return;
        }
      } catch {
        next(forbidden());
        return;
      }
    }
    next();
  };
}
