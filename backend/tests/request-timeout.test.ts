import { createServer, request as httpRequest } from "node:http";
import express from "express";
import { describe, expect, it } from "vitest";

import { createRequestBodyTimeout } from "../src/middleware/request-timeout.js";

describe("HTTP receive deadlines", () => {
  it("allows a slow upload but rejects an equally slow ordinary body", async () => {
    const app = express();
    app.use(createRequestBodyTimeout(100, 1_000));
    app.use(express.raw({ type: "*/*" }));
    app.post(/.*/, (_req, res) => res.sendStatus(204));
    app.use((_error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!res.headersSent) res.sendStatus(400);
      else next();
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP port");
    const port = address.port;
    async function slowBody(path: string, contentType: string) {
      return new Promise<number>((resolve, reject) => {
        const req = httpRequest({ host: "127.0.0.1", port, path, method: "POST", headers: { "content-type": contentType, "content-length": "2" } }, (res) => {
          res.resume();
          res.once("end", () => resolve(res.statusCode!));
        });
        const timer = setTimeout(() => req.end("b"), 250);
        req.once("close", () => clearTimeout(timer));
        req.once("error", reject);
        req.write("a");
      });
    }
    try {
      expect(await slowBody("/api/attachments", "multipart/form-data; boundary=test")).toBe(204);
      expect(await slowBody("/api/messages", "application/json")).toBe(408);
      // An arbitrary route cannot obtain the upload allowance with only a MIME header.
      expect(await slowBody("/api/messages", "multipart/form-data; boundary=test")).toBe(408);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
