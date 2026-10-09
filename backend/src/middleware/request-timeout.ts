import type { RequestHandler } from "express";

export const HTTP_REQUEST_TIMEOUT_MS = 15_000;
export const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;

/** Node's server-wide receive deadline must accommodate uploads. Narrow the
 * ordinary body deadline here, before JSON or multipart parsers consume it. */
export function createRequestBodyTimeout(
  generalMs = HTTP_REQUEST_TIMEOUT_MS,
  uploadMs = UPLOAD_REQUEST_TIMEOUT_MS,
): RequestHandler {
  return (request, response, next) => {
    if (!request.complete) {
      const isUpload = request.method === "POST" && Boolean(request.is("multipart/form-data")) &&
        /^\/api\/(?:attachments\/?|auth\/me\/image\/?|workspaces\/[^/]+\/image\/?)$/.test(request.path);
      const timer = setTimeout(() => {
        if (!response.headersSent) {
          response.setHeader("connection", "close");
          response.once("finish", () => request.destroy());
          response.status(408).json({ error: { code: "REQUEST_TIMEOUT", requestId: request.id } });
        } else {
          request.destroy();
        }
      }, isUpload ? uploadMs : generalMs);
      timer.unref();
      const clear = () => clearTimeout(timer);
      request.once("end", clear);
      request.once("close", clear);
      response.once("finish", clear);
      response.once("close", clear);
    }
    next();
  };
}
