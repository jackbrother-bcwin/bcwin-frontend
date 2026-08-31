import { afterEach, describe, expect, test } from "bun:test";
import {
  countdownSecondsUntil,
  createStuckZeroRecovery,
  isLivePeriod,
  pickLivePeriod,
  STUCK_ZERO_MS,
  STUCK_ZERO_RETRY_MS,
  type PeriodLike,
} from "./period-live";

const NOW = 1_700_000_000_000;
const origNow = Date.now;

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

function period(partial: Partial<PeriodLike> & { id: string }): PeriodLike {
  return {
    status: "ACTIVE",
    startTime: iso(-5_000),
    endTime: iso(15_000),
    ...partial,
  };
}

afterEach(() => {
  Date.now = origNow;
});

describe("pickLivePeriod", () => {
  test("returns currentPeriod when it still has time left", () => {
    Date.now = () => NOW;
    const current = period({ id: "live" });
    const expired = period({
      id: "old",
      endTime: iso(-1_000),
      status: "ENDED",
    });
    expect(pickLivePeriod(current, [expired, current])?.id).toBe("live");
  });

  test("never falls back to expired periods[0]", () => {
    Date.now = () => NOW;
    const dead = period({
      id: "dead",
      endTime: iso(-500),
      status: "ACTIVE",
    });
    expect(pickLivePeriod(dead, [dead])).toBeNull();
    expect(pickLivePeriod(null, [dead])).toBeNull();
  });

  test("picks ACTIVE with remaining time when currentPeriod is expired", () => {
    Date.now = () => NOW;
    const expired = period({ id: "expired", endTime: iso(-200) });
    const next = period({ id: "next", endTime: iso(20_000) });
    expect(pickLivePeriod(expired, [expired, next])?.id).toBe("next");
  });

  test("rejects a slot that has not started yet", () => {
    Date.now = () => NOW;
    const future = period({
      id: "future",
      startTime: iso(1_000),
      endTime: iso(31_000),
    });
    expect(isLivePeriod(future)).toBe(false);
    expect(pickLivePeriod(future, [future])).toBeNull();
  });

  test("keeps a period live during its final fractional second", () => {
    Date.now = () => NOW;
    const almostDone = period({ id: "almost-done", endTime: iso(250) });
    expect(isLivePeriod(almostDone)).toBe(true);
    expect(pickLivePeriod(almostDone, [almostDone])?.id).toBe("almost-done");
  });

  test("countdown does not show 00 before the deadline", () => {
    Date.now = () => NOW;
    expect(countdownSecondsUntil(iso(1))).toBe(1);
    expect(countdownSecondsUntil(iso(999))).toBe(1);
    expect(countdownSecondsUntil(iso(1001))).toBe(2);
    expect(countdownSecondsUntil(iso(0))).toBe(0);
  });
});

describe("createStuckZeroRecovery", () => {
  test("does not fire while countdown is still running", () => {
    const rec = createStuckZeroRecovery();
    let fires = 0;
    expect(rec.note(12, NOW, () => fires++)).toBe(false);
    expect(rec.note(1, NOW + 11_000, () => fires++)).toBe(false);
    expect(fires).toBe(0);
  });

  test("waits ~2s at 00 before the first recovery refetch", () => {
    const rec = createStuckZeroRecovery();
    let fires = 0;
    const refetch = () => {
      fires += 1;
    };
    expect(rec.note(0, NOW, refetch)).toBe(false);
    expect(rec.note(0, NOW + STUCK_ZERO_MS - 1, refetch)).toBe(false);
    expect(fires).toBe(0);
    expect(rec.note(0, NOW + STUCK_ZERO_MS, refetch)).toBe(true);
    expect(fires).toBe(1);
  });

  test("throttles later refetches while still at 00", () => {
    const rec = createStuckZeroRecovery();
    let fires = 0;
    rec.note(0, NOW, () => fires++);
    rec.note(0, NOW + STUCK_ZERO_MS, () => fires++);
    expect(fires).toBe(1);
    rec.note(0, NOW + STUCK_ZERO_MS + STUCK_ZERO_RETRY_MS - 1, () => fires++);
    expect(fires).toBe(1);
    rec.note(0, NOW + STUCK_ZERO_MS + STUCK_ZERO_RETRY_MS, () => fires++);
    expect(fires).toBe(2);
  });

  test("a live clock resets the 2s wait", () => {
    const rec = createStuckZeroRecovery();
    let fires = 0;
    rec.note(0, NOW, () => fires++);
    rec.note(0, NOW + STUCK_ZERO_MS, () => fires++);
    expect(fires).toBe(1);
    rec.note(28, NOW + STUCK_ZERO_MS + 200, () => fires++);
    rec.note(0, NOW + STUCK_ZERO_MS + 400, () => fires++);
    rec.note(0, NOW + STUCK_ZERO_MS + 400 + STUCK_ZERO_MS - 1, () => fires++);
    expect(fires).toBe(1);
    rec.note(0, NOW + STUCK_ZERO_MS + 400 + STUCK_ZERO_MS, () => fires++);
    expect(fires).toBe(2);
  });

  test("live clock does not inherit the previous 00 throttle", () => {
    const rec = createStuckZeroRecovery({ delayMs: 100, retryMs: 5000 });
    let fires = 0;
    rec.note(0, NOW, () => fires++);
    rec.note(0, NOW + 100, () => fires++);
    expect(fires).toBe(1);
    rec.note(10, NOW + 150, () => fires++);
    rec.note(0, NOW + 160, () => fires++);
    rec.note(0, NOW + 260, () => fires++);
    expect(fires).toBe(2);
  });

  test("does not overlap in-flight refetches", async () => {
    const rec = createStuckZeroRecovery();
    let fires = 0;
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    rec.note(0, NOW, () => pending);
    rec.note(0, NOW + STUCK_ZERO_MS, () => {
      fires += 1;
      return pending;
    });
    expect(fires).toBe(1);
    rec.note(0, NOW + STUCK_ZERO_MS + STUCK_ZERO_RETRY_MS, () => fires++);
    expect(fires).toBe(1);
    release();
    await pending;
    await Promise.resolve();
    rec.note(0, NOW + STUCK_ZERO_MS + STUCK_ZERO_RETRY_MS + 50, () => fires++);
    expect(fires).toBe(2);
  });

  test("reset forgets a partial 00 wait", () => {
    const rec = createStuckZeroRecovery();
    let fires = 0;
    rec.note(0, NOW, () => fires++);
    rec.reset();
    rec.note(0, NOW + STUCK_ZERO_MS, () => fires++);
    expect(fires).toBe(0);
    rec.note(0, NOW + STUCK_ZERO_MS + STUCK_ZERO_MS, () => fires++);
    expect(fires).toBe(1);
  });
});
