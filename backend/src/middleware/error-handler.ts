import type { ErrorRequestHandler, RequestHandler } from "express";

import type { ApiErrorResponse } from "../contracts/api.js";
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
