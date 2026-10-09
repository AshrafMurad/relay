import type { ErrorRequestHandler, RequestHandler } from "express";

import type { ApiErrorResponse } from "../contracts/api.js";
import { ApiError } from "../lib/api-error.js";
import type { Logger } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (request, response) => {
  const body: ApiErrorResponse = {
    error: {
      code: "NOT_FOUND",
      requestId: response.getHeader("x-request-id")?.toString(),
    },
  };

  response.status(404).json(body);
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ApiError) {
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          requestId: request.id === undefined ? undefined : String(request.id),
        },
      };

      response.status(error.statusCode).json(body);
      return;
    }

    logger.error({ err: error, requestId: request.id }, "Unhandled API error");

    const body: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        requestId: request.id === undefined ? undefined : String(request.id),
      },
    };

    response.status(500).json(body);
  };
}
