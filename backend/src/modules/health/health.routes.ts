import { Router } from "express";

import type { LivenessResponse } from "../../contracts/health.js";
import type { DependencyProbe } from "../../lib/database.js";
import { getReadiness } from "./health.service.js";

export function createHealthRouter(database: DependencyProbe, redis: DependencyProbe) {
  const router = Router();

  router.get("/live", (_request, response) => {
    const body: LivenessResponse = {
      service: "relay-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    };
    response.json(body);
  });

  router.get("/ready", async (_request, response) => {
    const body = await getReadiness(database, redis);
    response.status(body.status === "unavailable" ? 503 : 200).json(body);
  });

  return router;
}
