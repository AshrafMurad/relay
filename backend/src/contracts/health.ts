export type ServiceHealthStatus = "ok" | "unavailable";
export type ReadinessStatus = "ok" | "degraded" | "unavailable";

export interface DependencyHealth {
  status: ServiceHealthStatus;
  latencyMs: number;
}

export interface LivenessResponse {
  service: "relay-api";
  status: "ok";
  timestamp: string;
}

export interface ReadinessResponse {
  service: "relay-api";
  status: ReadinessStatus;
  timestamp: string;
  checks: {
    postgres: DependencyHealth;
    redis: DependencyHealth;
  };
}
