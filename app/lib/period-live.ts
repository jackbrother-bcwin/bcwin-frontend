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

/** True if period is ACTIVE and endTime is still in the future. */
export function isLivePeriod(p: PeriodLike | null | undefined): boolean {
  if (!p?.endTime) return false;
  if (String(p.status ?? "").toUpperCase() === "ENDED") return false;
  if (String(p.status ?? "").toUpperCase() === "RESOLVED") return false;
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
