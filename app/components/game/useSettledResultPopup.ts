"use client";

/**
 * Shared win/loss ResultPopup trigger for lottery games.
 *
 * Multi-bet period rules (ADR-0005):
 * 1. Bootstrap: mark already-settled bets as seen (no replay).
 * 2. Group eligible bets by period; wait until ALL in the cohort are settled.
 * 3. Any win → win popup, amount = sum of winAmounts on won bets only.
 * 4. All losses → loss popup, amount = sum of betAmounts (stakes).
 * 5. Period-safe: never open until result chips for THAT period exist.
 */

import { useCallback, useRef, useState } from "react";
import type { ResultChip } from "./resultChips";

export type ResultPopupState = {
  isWin: boolean;
  winAmount: number;
  periodNumber?: string;
  chips?: ResultChip[];
  resultsHeading?: string;
  /** WinGo legacy result fields (when chips not built) */
  resultNumber?: number;
  resultColor?: string;
  resultSize?: string;
};

export type BetLike = {
  id?: string;
  periodNumber?: string | null;
  periodId?: string | null;
  status?: string | null;
  betAmount?: number | null;
  result?: {
    isWin?: boolean | null;
    winAmount?: number | null;
  } | null;
};

export function samePeriodId(
  a?: string | number | null,
  b?: string | number | null
): boolean {
  if (a == null || b == null || a === "" || b === "") return false;
  return String(a) === String(b);
}

function isSettled(b: BetLike): boolean {
  if (b.result != null) return true;
  return ["WON", "LOST", "SETTLED"].includes(
    String(b.status ?? "").toUpperCase()
  );
}

function isWon(b: BetLike): boolean {
  if (b.result?.isWin) return true;
  return String(b.status ?? "").toUpperCase() === "WON";
}

function periodKey(b: BetLike): string {
  if (b.periodNumber != null && String(b.periodNumber) !== "") {
    return `n:${b.periodNumber}`;
  }
  if (b.periodId != null && String(b.periodId) !== "") {
    return `i:${b.periodId}`;
  }
  return `id:${b.id ?? "unknown"}`;
}

function aggregateCohort(cohort: BetLike[]): {
  isWin: boolean;
  winAmount: number;
} {
  const wins = cohort.filter(isWon);
  if (wins.length > 0) {
    const sum = wins.reduce(
      (s, b) => s + Number(b.result?.winAmount ?? 0),
      0
    );
    return { isWin: true, winAmount: sum };
  }
  const stakes = cohort.reduce((s, b) => s + Number(b.betAmount ?? 0), 0);
  return { isWin: false, winAmount: stakes };
}

export function useSettledResultPopup() {
  const [resultPopup, setResultPopup] = useState<ResultPopupState | null>(null);
  const seenSettledRef = useRef<Set<string>>(new Set());
  const pendingBetIdsRef = useRef<Set<string>>(new Set());
  const betsBootstrappedRef = useRef(false);

  const closeResultPopup = useCallback(() => setResultPopup(null), []);

  const resetResultPopupTracking = useCallback(() => {
    seenSettledRef.current = new Set();
    pendingBetIdsRef.current = new Set();
    betsBootstrappedRef.current = false;
    setResultPopup(null);
  }, []);

  const trackPendingBet = useCallback((betId?: string | null) => {
    if (betId) pendingBetIdsRef.current.add(betId);
  }, []);

  /**
   * @param opts.isOnLatest - bet belongs to the newest resolved period
   * @param opts.hasPeriodResult - true only when result chips for THIS bet's period exist
   * @param opts.enrich - build chips from the matched period only
   */
  const maybeShowResultPopup = useCallback(
    (
      bets: BetLike[],
      opts: {
        isOnLatest: (b: BetLike) => boolean;
        hasPeriodResult: (b: BetLike) => boolean;
        enrich: (
          b: BetLike
        ) => Omit<ResultPopupState, "isWin" | "winAmount"> & {
          periodNumber?: string;
        };
      }
    ) => {
      if (!betsBootstrappedRef.current) {
        for (const b of bets) {
          if (b.id && isSettled(b)) seenSettledRef.current.add(b.id);
        }
        betsBootstrappedRef.current = true;
        return;
      }

      // Bets that may participate in a popup (pending this session or on latest period)
      const eligible = bets.filter((b) => {
        if (!b.id) return false;
        if (seenSettledRef.current.has(b.id) && isSettled(b)) return false;
        const isPending = pendingBetIdsRef.current.has(b.id);
        const onLatest = opts.isOnLatest(b);
        return isPending || onLatest;
      });

      // Also include already-seen-unsettled? No — if not settled and not eligible, skip.
      // For cohort completeness: include ALL bets on the same period as any eligible bet
      // that are still in the list (so we wait for sibling bets on the period).
      const periodKeysWithEligible = new Set(eligible.map(periodKey));

      const byPeriod = new Map<string, BetLike[]>();
      for (const b of bets) {
        if (!b.id) continue;
        const key = periodKey(b);
        if (!periodKeysWithEligible.has(key)) continue;
        // Include any bet on that period (including ones not pending) so we wait for full settle
        const list = byPeriod.get(key) ?? [];
        list.push(b);
        byPeriod.set(key, list);
      }

      for (const [, cohort] of byPeriod) {
        // Must have at least one still-tracked / new settle candidate
        const hasNew = cohort.some(
          (b) =>
            b.id &&
            !seenSettledRef.current.has(b.id) &&
            (pendingBetIdsRef.current.has(b.id) || opts.isOnLatest(b))
        );
        if (!hasNew) continue;

        const sample = cohort[0]!;
        if (!opts.hasPeriodResult(sample)) continue;

        // Wait until every bet on this period is settled
        if (!cohort.every(isSettled)) continue;

        // Aggregate and mark all seen
        for (const b of cohort) {
          if (b.id) {
            seenSettledRef.current.add(b.id);
            pendingBetIdsRef.current.delete(b.id);
          }
        }

        const { isWin, winAmount } = aggregateCohort(cohort);
        const extra = opts.enrich(sample);
        setResultPopup({
          isWin,
          winAmount,
          periodNumber:
            extra.periodNumber ?? sample.periodNumber ?? undefined,
          chips: extra.chips,
          resultsHeading: extra.resultsHeading,
        });
        // One popup per call
        break;
      }
    },
    []
  );

  return {
    resultPopup,
    closeResultPopup,
    resetResultPopupTracking,
    trackPendingBet,
    maybeShowResultPopup,
  };
}
