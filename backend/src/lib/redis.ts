import { createClient } from "redis";
import { randomUUID } from "node:crypto";

import type { DependencyProbe } from "./database.js";
import type { Logger } from "./logger.js";
import type { RateLimitStore } from "./rate-limiter.js";
import { LOGIN_POLICY, type LoginAttemptStore } from "./login-protection.js";

export interface RedisConnection extends DependencyProbe, RateLimitStore, LoginAttemptStore {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  markPresenceOnline(userId: string, socketId: string): Promise<void>;
  refreshPresence(userId: string, socketId: string): Promise<void>;
  removePresence(userId: string, socketId: string): Promise<void>;
  getOnlineUserIds(userIds: string[]): Promise<string[]>;
  publishPresence(event: PresencePublication): Promise<void>;
  subscribePresence(listener: (event: PresencePublication) => void): void;
  publishWorkspaceRevocation(workspaceId: string, userId: string): Promise<void>;
  subscribeWorkspaceRevocation(listener: (workspaceId: string, userId: string) => void): void;
}

export interface PresencePublication {
  workspaceId: string;
  userId: string;
  status: "online" | "offline";
}

const PRESENCE_CHANNEL = "presence:updates";
const WORKSPACE_REVOCATION_CHANNEL = "workspace:revocations";
const PRESENCE_LEASE_MS = 75_000;
const RATE_LIMIT_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[1]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, math.max(1, tonumber(oldest[2]) + window - now)}
end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return {1, 0}
`;

const LOGIN_BEGIN_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local window = ${LOGIN_POLICY.failureWindowMs}
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - window)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
local blocked = tonumber(redis.call('HGET', KEYS[1], 'blocked') or '0')
if blocked > now then return {0, blocked - now} end
local lease = tonumber(redis.call('HGET', KEYS[1], 'lease') or '0')
if lease > now then return {0, 1000} end
if redis.call('ZCARD', KEYS[2]) + redis.call('ZCARD', KEYS[3]) >= ${LOGIN_POLICY.ipFailureLimit} then
  local retryAt = now + window
  local failure = redis.call('ZRANGE', KEYS[2], 0, 0, 'WITHSCORES')
  local pending = redis.call('ZRANGE', KEYS[3], 0, 0, 'WITHSCORES')
  if #failure > 0 then retryAt = math.min(retryAt, tonumber(failure[2]) + window) end
  if #pending > 0 then retryAt = math.min(retryAt, tonumber(pending[2])) end
  return {0, math.max(1, retryAt - now)}
end
redis.call('HSET', KEYS[1], 'token', ARGV[1], 'lease', now + ${LOGIN_POLICY.reservationMs})
redis.call('PEXPIRE', KEYS[1], window)
redis.call('ZADD', KEYS[3], now + ${LOGIN_POLICY.reservationMs}, ARGV[1])
redis.call('PEXPIRE', KEYS[3], window)
return {1, 0}
`;

const LOGIN_FINISH_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
redis.call('ZREM', KEYS[3], ARGV[1])
if redis.call('HGET', KEYS[1], 'token') ~= ARGV[1] then return 0 end
local lease = tonumber(redis.call('HGET', KEYS[1], 'lease') or '0')
redis.call('HDEL', KEYS[1], 'token', 'lease')
if lease <= now or ARGV[2] == 'cancelled' then return 0 end
if ARGV[2] == 'success' then
  redis.call('DEL', KEYS[1])
  return 1
end
local failures = redis.call('HINCRBY', KEYS[1], 'failures', 1)
local cooldown = 0
if failures >= ${LOGIN_POLICY.cooldownThreshold} then
  cooldown = math.min(${LOGIN_POLICY.maxCooldownMs}, 1000 * 2 ^ math.min(10, failures - ${LOGIN_POLICY.cooldownThreshold}))
end
redis.call('HSET', KEYS[1], 'blocked', now + cooldown)
redis.call('PEXPIRE', KEYS[1], ${LOGIN_POLICY.failureWindowMs})
redis.call('ZADD', KEYS[2], now, ARGV[1])
redis.call('PEXPIRE', KEYS[2], ${LOGIN_POLICY.failureWindowMs})
return 1
`;

export function createRedisConnection(url: string, logger: Logger): RedisConnection {
  let connectionAttempt: Promise<void> | undefined;
  const client = createClient({
    url,
    disableOfflineQueue: true,
    commandOptions: { timeout: 1_000 },
    socket: {
      connectTimeout: 2_000,
      reconnectStrategy(retries) {
        return Math.min(1_000 * 2 ** retries, 30_000);
      },
    },
  });
  const subscriber = client.duplicate();
  const instanceId = randomUUID();
  let presenceListener: ((event: PresencePublication) => void) | undefined;
  let workspaceRevocationListener: ((workspaceId: string, userId: string) => void) | undefined;
  let rateLimitsHealthy = true;
  let subscriptionsReady = false;

  client.on("error", (error) => {
    logger.warn({ err: error }, "Redis connection error");
  });
  subscriber.on("error", (error) => {
    logger.warn({ err: error }, "Redis subscriber connection error");
  });

  return {
    async connect() {
      if (client.isReady && subscriber.isReady && subscriptionsReady) return;
      // Complete setup in the background even if startup times out. Otherwise a
      // delayed Redis recovery would connect the client without subscriptions.
      connectionAttempt ??= (async () => {
        if (!client.isOpen) await client.connect();
        if (!subscriber.isOpen) await subscriber.connect();
        await subscriber.subscribe(PRESENCE_CHANNEL, (message) => {
          try {
            const event = JSON.parse(message) as Partial<PresencePublication>;
            if (event.workspaceId && event.userId && (event.status === "online" || event.status === "offline")) {
              presenceListener?.(event as PresencePublication);
            }
          } catch (error) {
            logger.warn({ err: error }, "Rejected malformed Redis presence event");
          }
        });
        await subscriber.subscribe(WORKSPACE_REVOCATION_CHANNEL, (message) => {
          try {
            const event = JSON.parse(message) as { workspaceId?: string; userId?: string };
            if (event.workspaceId && event.userId) workspaceRevocationListener?.(event.workspaceId, event.userId);
          } catch (error) {
            logger.warn({ err: error }, "Rejected malformed Redis workspace revocation");
          }
        });
        subscriptionsReady = true;
      })().finally(() => { connectionAttempt = undefined; });

      let timeout: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          connectionAttempt,
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => reject(new Error("Redis connection timed out")), 2_000);
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
    async probe() {
      if (!client.isReady || !subscriber.isReady || !subscriptionsReady || !rateLimitsHealthy) {
        return false;
      }

      try {
        return (await client.ping()) === "PONG";
      } catch {
        return false;
      }
    },
    async disconnect() {
      subscriptionsReady = false;
      if (subscriber.isOpen) {
        await subscriber.close();
      } else {
        subscriber.destroy();
      }
      if (client.isOpen) {
        await client.close();
      } else {
        client.destroy();
      }
    },
    async consumeRateLimit(key, limit, windowMs) {
      try {
        if (!client.isReady) throw new Error("Redis rate limits unavailable");
        const result = await client.eval(RATE_LIMIT_SCRIPT, {
          keys: [key],
          arguments: [String(limit), String(windowMs), randomUUID()],
        });
        if (!Array.isArray(result) || result.length !== 2) throw new Error("Invalid Redis rate limit response");
        rateLimitsHealthy = true;
        return { allowed: Number(result[0]) === 1, retryAfterMs: Number(result[1]) };
      } catch (error) {
        if (rateLimitsHealthy) logger.warn("Redis rate limits unavailable; using single-instance fallback");
        rateLimitsHealthy = false;
        throw error;
      }
    },
    async beginLoginAttempt(pairKey, ipKey, attemptId) {
      try {
        if (!client.isReady) throw new Error("Redis login protection unavailable");
        const result = await client.eval(LOGIN_BEGIN_SCRIPT, {
          keys: [pairKey, `${ipKey}:failures`, `${ipKey}:pending`],
          arguments: [attemptId],
        });
        if (!Array.isArray(result) || result.length !== 2) throw new Error("Invalid Redis login protection response");
        rateLimitsHealthy = true;
        return { allowed: Number(result[0]) === 1, retryAfterMs: Number(result[1]) };
      } catch (error) {
        rateLimitsHealthy = false;
        throw error;
      }
    },
    async finishLoginAttempt(pairKey, ipKey, attemptId, outcome) {
      try {
        if (!client.isReady) throw new Error("Redis login protection unavailable");
        await client.eval(LOGIN_FINISH_SCRIPT, {
          keys: [pairKey, `${ipKey}:failures`, `${ipKey}:pending`],
          arguments: [attemptId, outcome],
        });
        rateLimitsHealthy = true;
      } catch (error) {
        rateLimitsHealthy = false;
        throw error;
      }
    },
    async markPresenceOnline(userId, socketId) {
      const key = `presence:user:${userId}`;
      const now = Date.now();
      await client.zRemRangeByScore(key, 0, now);
      await client.zAdd(key, { score: now + PRESENCE_LEASE_MS, value: `${instanceId}:${socketId}` });
      await client.expire(key, Math.ceil(PRESENCE_LEASE_MS / 1_000) + 15);
    },
    async refreshPresence(userId, socketId) {
      const key = `presence:user:${userId}`;
      await client.zAdd(key, { score: Date.now() + PRESENCE_LEASE_MS, value: `${instanceId}:${socketId}` });
      await client.expire(key, Math.ceil(PRESENCE_LEASE_MS / 1_000) + 15);
    },
    async removePresence(userId, socketId) {
      await client.zRem(`presence:user:${userId}`, `${instanceId}:${socketId}`);
    },
    async getOnlineUserIds(userIds) {
      const now = Date.now();
      const online = await Promise.all(userIds.map(async (userId) => {
        const key = `presence:user:${userId}`;
        await client.zRemRangeByScore(key, 0, now);
        return await client.zCard(key) > 0 ? userId : undefined;
      }));
      return online.filter((userId): userId is string => Boolean(userId));
    },
    async publishPresence(event) {
      await client.publish(PRESENCE_CHANNEL, JSON.stringify(event));
    },
    subscribePresence(listener) {
      presenceListener = listener;
    },
    async publishWorkspaceRevocation(workspaceId, userId) {
      await client.publish(WORKSPACE_REVOCATION_CHANNEL, JSON.stringify({ workspaceId, userId }));
    },
    subscribeWorkspaceRevocation(listener) {
      workspaceRevocationListener = listener;
    },
  };
}
