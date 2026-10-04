import type { ErrorRequestHandler, RequestHandler } from "express";

import type { ApiErrorResponse } from "../contracts/api.js";
import { ApiError } from "../lib/api-error.js";
import type { Logger } from "../lib/logger.js";

export const notFoundHandler: RequestHandler = (request, response) => {
  const body: ApiErrorResponse = {
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found.",
      requestId: response.getHeader("x-request-id")?.toString(),
    },
  };

  response.status(404).json(body);
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    void next;

    if (error instanceof ApiError) {
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
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
        message: "An unexpected error occurred.",
        requestId: request.id === undefined ? undefined : String(request.id),
      },
    };

    response.status(500).json(body);
  };
}
