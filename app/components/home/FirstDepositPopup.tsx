"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as api from "../../lib/api";
import { formatINR } from "../../lib/format";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

/** Production fallback — must match backend FALLBACK_FIRST_DEPOSIT_TIERS (300 → 100k) */
export const FD_FALLBACK_TIERS = [
  { requirement: 300, reward: 28 },
  { requirement: 500, reward: 58 },
  { requirement: 1000, reward: 108 },
  { requirement: 3000, reward: 188 },
  { requirement: 5000, reward: 288 },
  { requirement: 10000, reward: 588 },
  { requirement: 30000, reward: 1288 },
  { requirement: 50000, reward: 1888 },
  { requirement: 100000, reward: 3888 },
] as const;

export type FirstDepositTierStatus =
  | "deposit" // not yet deposited / not this tier
  | "claim" // COMPLETED_UNCOLLECTED — this tier only
  | "claimed"
  | "unavailable"; // other tiers after first deposit locked

export interface FirstDepositTierRow {
  tier: number;
  requirement: number;
  reward: number;
  /** Progress toward THIS tier only (0 if unavailable) */
  current: number;
  claimed: boolean;
  eligible: boolean;
  unavailable: boolean;
  status: FirstDepositTierStatus;
  bonusId?: string | null;
}

interface Props {
  open: boolean;
  tiers: FirstDepositTierRow[];
  noRemindToday: boolean;
  onToggleNoRemind: (v: boolean) => void;
  onClose: () => void;
  onDeposit: () => void;
  onActivity: () => void;
  onClaim?: (tier: FirstDepositTierRow) => Promise<void>;
  loading?: boolean;
}

/**
 * Extra first deposit bonus modal.
 * Only one tier is ever claimable (max for first deposit); others stay empty/locked.
 */
export default function FirstDepositPopup({
  open,
  tiers,
  noRemindToday,
  onToggleNoRemind,
  onClose,
  onDeposit,
  onActivity,
  onClaim,
  loading,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const claimingRef = useRef<Set<number>>(new Set());
  const [claimingTiers, setClaimingTiers] = useState<Set<number>>(new Set());
  useSpaBackClose(open, onClose, "first-deposit-popup");
  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="promo-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="First deposit bonus"
    >
      <div className="promo-fd-wrap">
        <div className="promo-fd-card">
          <h2 className="promo-fd-title">Extra first deposit bonus</h2>
          <p className="promo-fd-sub">
            First deposit only · highest matching tier · claim once
          </p>

          <div className="promo-fd-scroll">
            {loading && (
              <p className="py-8 text-center text-[12px] text-white/40">
                Loading bonuses…
              </p>
            )}
            {!loading && tiers.length === 0 && (
              <p className="py-8 text-center text-[12px] text-white/40">
                No tiers available
              </p>
            )}
            {tiers.map((t) => {
              const req = Math.max(0, t.requirement);
              // Never fill bars for locked/unavailable tiers
              const cur =
                t.unavailable || t.status === "unavailable"
                  ? 0
                  : Math.min(Math.max(0, t.current), req || 1);
              const pct =
                t.status === "claimed" || t.status === "claim"
                  ? 100
                  : req > 0
                    ? Math.min(100, (cur / req) * 100)
                    : 0;

              return (
                <div
                  key={t.tier}
                  className={`promo-fd-tier${
                    t.unavailable || t.status === "unavailable"
                      ? " promo-fd-tier--locked"
                      : ""
                  }`}
                  style={
                    t.unavailable || t.status === "unavailable"
                      ? { opacity: 0.45 }
                      : undefined
                  }
                >
                  <div className="promo-fd-tier-top">
                    <div className="min-w-0 flex-1">
                      <p className="promo-fd-tier-name">
                        First deposit
                        <span className="promo-fd-tier-amt">{req}</span>
                      </p>
                      <p className="promo-fd-tier-desc">
                        Deposit {req} for the first time and you will receive{" "}
                        {t.reward} bonus
                      </p>
                    </div>
                    <span className="promo-fd-tier-reward">
                      + {formatINR(t.reward)}
                    </span>
                  </div>
                  <div className="promo-fd-tier-bot">
                    <div className="promo-fd-progress">
                      <div
                        className="promo-fd-progress-fill"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="promo-fd-progress-label">
                        {t.status === "claimed" || t.status === "claim"
                          ? `${req}/${req}`
                          : t.unavailable || t.status === "unavailable"
                            ? `0/${req}`
                            : `${cur}/${req}`}
                      </span>
                    </div>
                    {t.status === "claimed" && (
                      <button
                        type="button"
                        className="promo-fd-deposit-btn promo-fd-deposit-btn--claimed"
                        disabled
                      >
                        Claimed
                      </button>
                    )}
                    {t.status === "claim" && (
                      <button
                        type="button"
                        className="promo-fd-deposit-btn promo-fd-deposit-btn--claim"
                        disabled={claimingTiers.has(t.tier)}
                        onClick={async () => {
                          if (claimingRef.current.has(t.tier)) return;
                          claimingRef.current.add(t.tier);
                          setClaimingTiers(new Set(claimingRef.current));
                          try {
                            await onClaim?.(t);
                          } finally {
                            claimingRef.current.delete(t.tier);
                            setClaimingTiers(new Set(claimingRef.current));
                          }
                        }}
                      >
                        {claimingTiers.has(t.tier) ? "Claiming…" : "Claim"}
                      </button>
                    )}
                    {t.status === "unavailable" && (
                      <button
                        type="button"
                        className="promo-fd-deposit-btn promo-fd-deposit-btn--claimed"
                        disabled
                      >
                        Unavailable
                      </button>
                    )}
                    {t.status === "deposit" && (
                      <button
                        type="button"
                        className="promo-fd-deposit-btn"
                        onClick={onDeposit}
                      >
                        Deposit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="promo-fd-footer">
            <label className="promo-fd-remind">
              <input
                type="checkbox"
                checked={noRemindToday}
                onChange={(e) => onToggleNoRemind(e.target.checked)}
              />
              <span className="promo-fd-remind-box" aria-hidden />
              <span>No more reminders today</span>
            </label>
            <button
              type="button"
              className="promo-fd-activity"
              onClick={onActivity}
            >
              Activity
            </button>
          </div>
        </div>

        <button
          type="button"
          className="promo-fd-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}

function tierStatus(opts: {
  claimed: boolean;
  eligible: boolean;
  unavailable: boolean;
}): FirstDepositTierStatus {
  if (opts.claimed) return "claimed";
  if (opts.eligible) return "claim";
  if (opts.unavailable) return "unavailable";
  return "deposit";
}

/** Map API progress → tier rows (single max-tier fill, not all bars) */
export function mapFirstDepositTiers(
  data: api.FirstDepositProgress | null | undefined
): FirstDepositTierRow[] {
  const claimedAll = Boolean(data?.claimed);

  if (!data?.tiers?.length) {
    return FD_FALLBACK_TIERS.map((t, i) => ({
      tier: i,
      requirement: t.requirement,
      reward: t.reward,
      current: 0,
      claimed: false,
      eligible: false,
      unavailable: false,
      status: "deposit" as const,
      bonusId: null,
    }));
  }

  return data.tiers.map((t, i) => {
    const requirement = Number(t.requirement?.deposit ?? 0);
    const claimed = Boolean(t.claimed) || (claimedAll && Boolean(t.eligible));
    const eligible = Boolean(t.eligible) && !claimed;
    const unavailable = Boolean(t.unavailable) && !eligible && !claimed;
    // Prefer per-tier current from API; never use global currentDeposit on every row
    const current = unavailable
      ? 0
      : Number(t.current?.deposit ?? 0);

    return {
      tier: t.tier ?? i,
      requirement,
      reward: Number(t.reward ?? 0),
      current,
      claimed,
      eligible,
      unavailable,
      status: tierStatus({ claimed, eligible, unavailable }),
      bonusId: t.bonusId ?? null,
    };
  });
}

export async function fetchFirstDepositProgress(): Promise<{
  tiers: FirstDepositTierRow[];
  claimed: boolean;
  shouldOffer: boolean;
}> {
  try {
    const res = await api.getActivityProgress();
    const fd = res.data?.firstDeposit;
    const tiers = mapFirstDepositTiers(fd);
    const claimed = Boolean(fd?.claimed);
    // Prefer server offerPopup; fallback: not claimed and (no deposit or claimable)
    const shouldOffer =
      typeof fd?.offerPopup === "boolean"
        ? fd.offerPopup
        : !claimed &&
          (Number(fd?.currentDeposit ?? 0) <= 0 ||
            tiers.some((t) => t.eligible));
    return { tiers, claimed, shouldOffer };
  } catch {
    return {
      tiers: mapFirstDepositTiers(null),
      claimed: false,
      shouldOffer: true,
    };
  }
}
