import { afterEach, describe, expect, it, vi } from "vitest";

import { createLoginProtection, LOGIN_POLICY, type LoginAttemptStore } from "../src/lib/login-protection.js";

afterEach(() => vi.restoreAllMocks());

describe("login protection", () => {
  it("starts at one second after five failures, doubles, caps, and ignores blocked retries", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const protection = createLoginProtection();
    for (let failures = 1; failures <= 15; failures++) {
      const attempt = await protection.begin("ip", "user@example.com");
      expect(attempt.allowed).toBe(true);
      await attempt.finish("failure");
      if (failures < 5) continue;
      const delay = Math.min(900_000, 1_000 * 2 ** (failures - 5));
      expect(await protection.begin("ip", "user@example.com")).toMatchObject({ allowed: false, retryAfterMs: delay });
      now += delay / 2;
      expect(await protection.begin("ip", "user@example.com")).toMatchObject({ allowed: false, retryAfterMs: delay / 2 });
      now += delay / 2;
    }
  });

  it("does not exhaust failure budgets on successful logins and resets the pair after success", async () => {
    const protection = createLoginProtection();
    for (let index = 0; index < 75; index++) {
      const attempt = await protection.begin("shared-ip", "user@example.com");
      expect(attempt.allowed).toBe(true);
      await attempt.finish("success");
    }
    for (let index = 0; index < 4; index++) await (await protection.begin("shared-ip", "user@example.com")).finish("failure");
    await (await protection.begin("shared-ip", "user@example.com")).finish("success");
    await (await protection.begin("shared-ip", "user@example.com")).finish("failure");
    const attempt = await protection.begin("shared-ip", "user@example.com");
    expect(attempt.allowed).toBe(true);
    await attempt.finish("cancelled");
  });

  it("keeps other users and other IPs usable while normalizing an account identifier", async () => {
    const protection = createLoginProtection();
    for (let index = 0; index < 5; index++) await (await protection.begin("one", " USER@Example.com ")).finish("failure");
    expect((await protection.begin("one", "user@example.com")).allowed).toBe(false);
    expect((await protection.begin("one", "teammate@example.com")).allowed).toBe(true);
    expect((await protection.begin("two", "user@example.com")).allowed).toBe(true);
  });

  it("blocks password spraying after 50 failures across accounts without clearing it on success", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const protection = createLoginProtection();
    for (let index = 0; index < 49; index++) await (await protection.begin("ip", `${index}@example.com`)).finish("failure");
    await (await protection.begin("ip", "valid@example.com")).finish("success");
    await (await protection.begin("ip", "last@example.com")).finish("failure");
    expect(await protection.begin("ip", "another@example.com")).toMatchObject({ allowed: false, retryAfterMs: LOGIN_POLICY.failureWindowMs });
    expect((await protection.begin("other-ip", "another@example.com")).allowed).toBe(true);
  });

  it("reserves concurrent attempts atomically and releases abandoned reservations", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const protection = createLoginProtection();
    const results = await Promise.all(Array.from({ length: 20 }, () => protection.begin("ip", "user@example.com")));
    expect(results.filter((attempt) => attempt.allowed)).toHaveLength(1);
    now += LOGIN_POLICY.reservationMs;
    const replacement = await protection.begin("ip", "user@example.com");
    expect(replacement.allowed).toBe(true);
    // A late completion must not alter the newer attempt's reservation.
    await results.find((attempt) => attempt.allowed)!.finish("failure");
    expect((await protection.begin("ip", "user@example.com")).allowed).toBe(false);
    await replacement.finish("success");
    expect((await protection.begin("ip", "user@example.com")).allowed).toBe(true);
  });

  it("expires idle failures and does not count database errors as bad credentials", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const protection = createLoginProtection();
    for (let index = 0; index < 60; index++) {
      const attempt = await protection.begin("ip", "user@example.com");
      expect(attempt.allowed).toBe(true);
      await attempt.finish("cancelled");
    }
    for (let index = 0; index < 5; index++) await (await protection.begin("ip", "user@example.com")).finish("failure");
    now += LOGIN_POLICY.failureWindowMs;
    for (let index = 0; index < 5; index++) {
      const attempt = await protection.begin("ip", "user@example.com");
      expect(attempt.allowed).toBe(true);
      await attempt.finish("failure");
    }
    expect(await protection.begin("ip", "user@example.com")).toMatchObject({ allowed: false, retryAfterMs: 1_000 });
  });

  it("hashes identities, preserves local failures through outages, and makes completion idempotent", async () => {
    const store: LoginAttemptStore = {
      beginLoginAttempt: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
      finishLoginAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const protection = createLoginProtection(store);
    for (let index = 0; index < 4; index++) await (await protection.begin("private-ip", "private@example.com")).finish("failure");
    vi.mocked(store.beginLoginAttempt).mockRejectedValueOnce(new Error("Redis unavailable"));
    vi.mocked(store.finishLoginAttempt).mockRejectedValueOnce(new Error("Redis unavailable"));
    const attempt = await protection.begin("private-ip", "private@example.com");
    await attempt.finish("failure");
    await attempt.finish("failure");
    expect((await protection.begin("private-ip", "private@example.com")).allowed).toBe(false);
    expect(store.finishLoginAttempt).toHaveBeenCalledTimes(5);
    const [pairKey, ipKey] = vi.mocked(store.beginLoginAttempt).mock.calls[0]!;
    expect(pairKey).not.toContain("private@example.com");
    expect(ipKey).not.toContain("private-ip");
  });

  it("releases the local reservation when another instance's shared budget rejects it", async () => {
    const store: LoginAttemptStore = {
      beginLoginAttempt: vi.fn().mockResolvedValueOnce({ allowed: false, retryAfterMs: 2_000 }).mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
      finishLoginAttempt: vi.fn().mockResolvedValue(undefined),
    };
    const protection = createLoginProtection(store);
    expect(await protection.begin("ip", "user@example.com")).toMatchObject({ allowed: false, retryAfterMs: 2_000 });
    expect((await protection.begin("ip", "user@example.com")).allowed).toBe(true);
  });
});
