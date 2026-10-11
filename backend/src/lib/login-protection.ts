import { createHash, randomUUID } from "node:crypto";

import type { RateLimitResult } from "./rate-limiter.js";

export const LOGIN_POLICY = {
  requestLimit: 100,
  requestWindowMs: 60_000,
  failureWindowMs: 15 * 60_000,
  ipFailureLimit: 50,
  cooldownThreshold: 5,
  maxCooldownMs: 15 * 60_000,
  reservationMs: 60_000,
} as const;

export type LoginOutcome = "success" | "failure" | "cancelled";

export interface LoginAttemptStore {
  beginLoginAttempt(pairKey: string, ipKey: string, attemptId: string): Promise<RateLimitResult>;
  finishLoginAttempt(pairKey: string, ipKey: string, attemptId: string, outcome: LoginOutcome): Promise<void>;
}

export interface LoginAttempt extends RateLimitResult {
  finish(outcome: LoginOutcome): Promise<void>;
}

export interface LoginProtection {
  begin(ip: string, email: string): Promise<LoginAttempt>;
}

interface PairState {
  failures: number;
  blockedUntil: number;
  expiresAt: number;
  pending?: { id: string; expiresAt: number };
}

interface IpState {
  failures: number[];
  pending: Map<string, number>;
}

/** Outcome-aware reservations prevent parallel password checks bypassing limits. */
export function createLoginProtection(store?: LoginAttemptStore): LoginProtection {
  const pairs = new Map<string, PairState>();
  const ips = new Map<string, IpState>();
  const maxKeys = 50_000;
  let nextSweep = 0;

  function pruneIp(state: IpState, now: number) {
    state.failures = state.failures.filter((time) => time > now - LOGIN_POLICY.failureWindowMs);
    for (const [id, expiresAt] of state.pending) {
      if (expiresAt <= now) state.pending.delete(id);
    }
  }

  function beginLocal(pairKey: string, ipKey: string, id: string): RateLimitResult {
    const now = Date.now();
    if (now >= nextSweep) {
      for (const [key, pair] of pairs) {
        if (pair.expiresAt <= now) pairs.delete(key);
      }
      for (const [key, ip] of ips) {
        pruneIp(ip, now);
        if (!ip.failures.length && !ip.pending.size) ips.delete(key);
      }
      nextSweep = now + 60_000;
    }

    const pair = pairs.get(pairKey);
    if (pair && pair.expiresAt > now) {
      if (pair.blockedUntil > now) return { allowed: false, retryAfterMs: pair.blockedUntil - now };
      if (pair.pending && pair.pending.expiresAt > now) return { allowed: false, retryAfterMs: 1_000 };
    }
    const ip = ips.get(ipKey) ?? { failures: [], pending: new Map<string, number>() };
    pruneIp(ip, now);
    if (ip.failures.length + ip.pending.size >= LOGIN_POLICY.ipFailureLimit) {
      const retryAt = Math.min(
        ip.failures.length ? ip.failures[0]! + LOGIN_POLICY.failureWindowMs : Infinity,
        ...ip.pending.values(),
      );
      return { allowed: false, retryAfterMs: Math.max(1, retryAt - now) };
    }
    const newKeys = Number(!pairs.has(pairKey)) + Number(!ips.has(ipKey));
    if (pairs.size + ips.size + newKeys > maxKeys) return { allowed: false, retryAfterMs: 60_000 };

    const state = pair && pair.expiresAt > now ? pair : { failures: 0, blockedUntil: 0, expiresAt: 0 };
    state.pending = { id, expiresAt: now + LOGIN_POLICY.reservationMs };
    state.expiresAt = now + LOGIN_POLICY.failureWindowMs;
    pairs.set(pairKey, state);
    ip.pending.set(id, now + LOGIN_POLICY.reservationMs);
    ips.set(ipKey, ip);
    return { allowed: true, retryAfterMs: 0 };
  }

  function finishLocal(pairKey: string, ipKey: string, id: string, outcome: LoginOutcome) {
    const now = Date.now();
    const pair = pairs.get(pairKey);
    const ip = ips.get(ipKey);
    ip?.pending.delete(id);
    if (!pair || pair.pending?.id !== id) return;
    const expired = pair.pending.expiresAt <= now;
    delete pair.pending;
    if (expired || outcome === "cancelled") return;
    if (outcome === "success") {
      pairs.delete(pairKey);
      return;
    }
    pair.failures += 1;
    const cooldownMs = pair.failures < LOGIN_POLICY.cooldownThreshold ? 0 : Math.min(
      LOGIN_POLICY.maxCooldownMs,
      1_000 * 2 ** Math.min(10, pair.failures - LOGIN_POLICY.cooldownThreshold),
    );
    pair.blockedUntil = now + cooldownMs;
    pair.expiresAt = now + LOGIN_POLICY.failureWindowMs;
    ip?.failures.push(now);
  }

  return {
    async begin(ip, email) {
      const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
      const pairKey = `login:v2:pair:${hash([ip, email.trim().toLowerCase()])}`;
      const ipKey = `login:v2:ip:${hash(ip)}`;
      const id = randomUUID();
      const local = beginLocal(pairKey, ipKey, id);
      let finished = false;
      let sharedAttempted = false;
      let result = local;
      if (local.allowed && store) {
        sharedAttempted = true;
        try {
          result = await store.beginLoginAttempt(pairKey, ipKey, id);
          if (!result.allowed) finishLocal(pairKey, ipKey, id, "cancelled");
        } catch {
          // Mirror admissions/outcomes locally while healthy, preserving protection
          // during Redis outage and recovery for the single-instance V1 deployment.
        }
      }
      return {
        ...result,
        async finish(outcome) {
          if (finished || !result.allowed) return;
          finished = true;
          finishLocal(pairKey, ipKey, id, outcome);
          if (sharedAttempted && store) {
            try {
              await store.finishLoginAttempt(pairKey, ipKey, id, outcome);
            } catch {
              // The Redis reservation expires; do not fail a valid login or
              // overwrite the original authentication error during degradation.
            }
          }
        },
      };
    },
  };
}
