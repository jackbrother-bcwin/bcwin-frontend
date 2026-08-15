"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { formatINR } from "../../lib/format";

import { MIN_LIFETIME_DEPOSIT_TO_PLAY } from "../../lib/play-deposit-gate";

/** @deprecated use MIN_LIFETIME_DEPOSIT_TO_PLAY — same ₹100 play gate */
export const INOUT_MIN_TOTAL_DEPOSIT = MIN_LIFETIME_DEPOSIT_TO_PLAY;

interface Props {
  open: boolean;
  gameName?: string;
  /** User's lifetime successful deposit total (for message) */
  totalDeposit?: number;
  required?: number;
  /** Inout launch vs lottery bet confirm */
  intent?: "play" | "bet";
  onClose: () => void;
  onDeposit: () => void;
}

/**
 * Warning when user tries to open a 3rd-party game without enough total recharge.
 */
export default function ThirdPartyDepositGate({
  open,
  gameName,
  totalDeposit = 0,
  required = INOUT_MIN_TOTAL_DEPOSIT,
  intent = "play",
  onClose,
  onDeposit,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useSpaBackClose(open, onClose, "inout-deposit-gate");
  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  const need = Math.max(0, required - totalDeposit);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inout-gate-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.72)" }}
        aria-hidden
      />

      <div
        className="relative z-10 w-full max-w-[320px] px-6 pt-7 pb-6"
        style={{
          background: "#222225",
          borderRadius: 18,
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[22px]"
            style={{
              background: "linear-gradient(145deg,#3a2e12,#1a1408)",
              border: "1.5px solid rgba(254,211,88,0.45)",
              boxShadow: "0 4px 16px rgba(254,211,88,0.2)",
            }}
            aria-hidden
          >
            🔒
          </div>
        </div>

        <h2
          id="inout-gate-title"
          className="mb-2 text-center text-[16px] font-bold leading-snug"
          style={{ color: "#FFE8D6" }}
        >
          Recharge required
        </h2>
        <p className="mb-1 text-center text-[12px] leading-relaxed text-white/55">
          {gameName ? (
            <>
              {intent === "bet" ? "To place a bet on" : "To play"}{" "}
              <span className="font-semibold text-[#FED358]">{gameName}</span>
              , you need a lifetime recharge of at least{" "}
              <span className="font-bold text-white">{formatINR(required, 0)}</span>.
            </>
          ) : (
            <>
              {intent === "bet"
                ? "Placing a bet requires"
                : "Games require"}{" "}
              a lifetime recharge of at least{" "}
              <span className="font-bold text-white">{formatINR(required, 0)}</span>.
            </>
          )}
        </p>
        <p className="mb-5 text-center text-[11px] text-white/40">
          Your total:{" "}
          <span className="font-semibold text-white/70">
            {formatINR(totalDeposit, 0)}
          </span>
          {need > 0 && (
            <>
              {" "}
              · Need{" "}
              <span className="font-semibold text-[#FED358]">
                {formatINR(need, 0)}
              </span>{" "}
              more
            </>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onDeposit}
            className="h-[46px] w-full rounded-full text-[15px] font-bold active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(180deg, #FFD166 0%, #FFA03D 100%)",
              color: "#1A1A1A",
              boxShadow: "0 4px 14px rgba(255, 160, 61, 0.35)",
            }}
          >
            Deposit now
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] w-full rounded-full text-[15px] font-bold active:scale-[0.98] transition-transform"
            style={{
              background: "transparent",
              color: "#FFC107",
              border: "1.5px solid #FFC107",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
