/**
 * Helpers for live lottery period selection / countdown.
 * Never treat an expired period as the "current" clock source.
 */

import { secondsUntil } from "./format";

export type PeriodLike = {
  id?: string;
  periodNumber?: string;
  status?: string;
  endTime?: string | null;
  startTime?: string | null;
  durationSeconds?: number;
};

/** True if period is ACTIVE, has started, and endTime is still in the future. */
export function isLivePeriod(p: PeriodLike | null | undefined): boolean {
  if (!p?.endTime) return false;
  if (String(p.status ?? "").toUpperCase() === "ENDED") return false;
  if (String(p.status ?? "").toUpperCase() === "RESOLVED") return false;
  if (p.startTime && secondsUntil(p.startTime) > 0) return false;
  return secondsUntil(p.endTime) > 0;
}

/**
 * Prefer API currentPeriod, then any ACTIVE with remaining time.
 * NEVER fall back to periods[0] if it is expired — that freezes countdown at 00.
 */
export function pickLivePeriod<T extends PeriodLike>(
  currentPeriod: T | null | undefined,
  periods: T[] | null | undefined
): T | null {
  if (currentPeriod && isLivePeriod(currentPeriod)) return currentPeriod;
  const active = periods?.find(
    (p) =>
      String(p.status ?? "").toUpperCase() === "ACTIVE" && isLivePeriod(p)
  );
  if (active) return active;
  if (currentPeriod && isLivePeriod(currentPeriod)) return currentPeriod;
  return null;
}

/** Countdown may sit at 00 this long (normal 00 handoff) before we refetch. */
export const STUCK_ZERO_MS = 2000;
/** Min gap between recovery refetches while still at 00. */
export const STUCK_ZERO_RETRY_MS = 1500;

/**
 * If the clock stays at 00 longer than a normal handoff gap, keep refetching
 * the live period. Does not change the 5s/10s betting lock.
 */
export function createStuckZeroRecovery(opts?: {
  delayMs?: number;
  retryMs?: number;
}) {
  const delayMs = opts?.delayMs ?? STUCK_ZERO_MS;
  const retryMs = opts?.retryMs ?? STUCK_ZERO_RETRY_MS;
  let zeroSince: number | null = null;
  let inFlight = false;
  let lastFireAt = 0;

  return {
    /**
     * Call on every tick with remaining seconds.
     * After `delayMs` at 00, starts `refetch` (throttled by `retryMs`).
     * Returns true if a recovery refetch started this call.
     */
    note(
      left: number,
      now: number,
      refetch: () => void | Promise<void>
    ): boolean {
      if (left > 0) {
        zeroSince = null;
        lastFireAt = 0;
        return false;
      }
      if (zeroSince == null) {
        zeroSince = now;
        return false;
      }
      if (now - zeroSince < delayMs) return false;
      if (inFlight) return false;
      if (lastFireAt > 0 && now - lastFireAt < retryMs) return false;
      inFlight = true;
      lastFireAt = now;
      const result = refetch();
      if (result != null && typeof (result as Promise<void>).then === "function") {
        Promise.resolve(result).finally(() => {
          inFlight = false;
        });
      } else {
        inFlight = false;
      }
      return true;
    },
    reset() {
      zeroSince = null;
      inFlight = false;
      lastFireAt = 0;
    },
  };
}
