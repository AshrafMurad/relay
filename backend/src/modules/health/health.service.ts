import type { DependencyHealth, ReadinessResponse } from "../../contracts/health.js";
import type { DependencyProbe } from "../../lib/database.js";

const PROBE_TIMEOUT_MS = 2_000;

async function checkDependency(dependency: DependencyProbe): Promise<DependencyHealth> {
  const startedAt = performance.now();
  let timeout: NodeJS.Timeout | undefined;

  try {
    let available = false;
    try {
      available = await Promise.race([
        dependency.probe(),
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS);
        }),
      ]);
    } catch {
      available = false;
    }

    return {
      status: available ? "ok" : "unavailable",
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function getReadiness(
  database: DependencyProbe,
  redis: DependencyProbe,
): Promise<ReadinessResponse> {
  const [postgres, redisStatus] = await Promise.all([
    checkDependency(database),
    checkDependency(redis),
  ]);

  const status =
    postgres.status === "unavailable"
      ? "unavailable"
      : redisStatus.status === "unavailable"
        ? "degraded"
        : "ok";

  return {
    service: "relay-api",
    status,
    timestamp: new Date().toISOString(),
    checks: { postgres, redis: redisStatus },
  };
}
