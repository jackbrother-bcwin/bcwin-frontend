"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface WithdrawSuccessModalProps {
  open: boolean;
  onConfirm: () => void;
}

/**
 * Withdrawal-request-successful modal — green ✓ badge with confetti accents,
 * "We will complete the withdrawal within 2 hours!" message,
 * and a gold Confirm button. Matches BCWIN dark theme.
 */
export default function WithdrawSuccessModal({
  open,
  onConfirm,
}: WithdrawSuccessModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useSpaBackClose(open, onConfirm, "withdraw-success");
  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-success-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onConfirm();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.72)" }}
        aria-hidden
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[320px] px-6 pt-8 pb-6"
        style={{
          background: "#222225",
          borderRadius: 18,
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
          animation: "wdSuccessSlideUp 0.35s ease-out",
        }}
      >
        {/* Confetti + Checkmark area */}
        <div className="mb-5 flex justify-center">
          <div className="relative" style={{ width: 90, height: 90 }}>
            {/* Confetti dots */}
            <span
              className="absolute"
              style={{
                top: 6, left: 4,
                width: 8, height: 8,
                borderRadius: "50%",
                background: "#FED358",
                animation: "wdConfettiBounce 1.2s ease-in-out infinite 0.1s",
              }}
            />
            <span
              className="absolute"
              style={{
                top: 0, left: 28,
                width: 6, height: 6,
                borderRadius: "50%",
                background: "#5eead4",
                animation: "wdConfettiBounce 1.2s ease-in-out infinite 0.3s",
              }}
            />
            <span
              className="absolute"
              style={{
                top: 14, right: 2,
                width: 7, height: 7,
                borderRadius: "50%",
                background: "#5eead4",
                animation: "wdConfettiBounce 1.2s ease-in-out infinite 0.5s",
              }}
            />
            <span
              className="absolute"
              style={{
                top: 2, right: 18,
                width: 5, height: 5,
                borderRadius: "50%",
                background: "#FED358",
                animation: "wdConfettiBounce 1.2s ease-in-out infinite 0.2s",
              }}
            />
            {/* Slash accents */}
            <span
              className="absolute"
              style={{
                top: 10, left: 14,
                width: 12, height: 3,
                borderRadius: 2,
                background: "#FED358",
                transform: "rotate(-35deg)",
                animation: "wdConfettiBounce 1.2s ease-in-out infinite 0.15s",
              }}
            />
            <span
              className="absolute"
              style={{
                top: 6, right: 8,
                width: 10, height: 3,
                borderRadius: 2,
                background: "#FED358",
                transform: "rotate(35deg)",
                animation: "wdConfettiBounce 1.2s ease-in-out infinite 0.4s",
              }}
            />

            {/* Green circle + check */}
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 60,
                height: 60,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #5eead4 0%, #14b8a6 50%, #0d9488 100%)",
                boxShadow:
                  "0 6px 22px rgba(20, 184, 166, 0.45), 0 0 0 4px rgba(94, 234, 212, 0.15)",
                animation: "wdCheckPop 0.45s ease-out 0.15s both",
              }}
            >
              {/* SVG Checkmark */}
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                style={{ animation: "wdCheckDraw 0.4s ease-out 0.45s both" }}
              >
                <path
                  d="M5 13l4 4L19 7"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <h2
          id="withdraw-success-title"
          className="text-center text-[19px] font-bold leading-snug mb-2"
          style={{ color: "#FFFFFF" }}
        >
          Withdrawal request successful
        </h2>

        {/* Subtitle */}
        <p
          className="text-center text-[15px] leading-relaxed mb-6"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          We will complete the withdrawal within 2 hours!
          <br />
          Please wait patiently...
        </p>

        {/* Confirm button */}
        <button
          type="button"
          onClick={onConfirm}
          className="w-full h-[46px] rounded-full text-[17px] font-bold active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(180deg, #FFD166 0%, #FFA03D 100%)",
            color: "#1A1A1A",
            boxShadow: "0 4px 14px rgba(255, 160, 61, 0.35)",
          }}
        >
          Confirm
        </button>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes wdSuccessSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wdCheckPop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes wdCheckDraw {
          from { opacity: 0; stroke-dasharray: 30; stroke-dashoffset: 30; }
          to   { opacity: 1; stroke-dasharray: 30; stroke-dashoffset: 0; }
        }
        @keyframes wdConfettiBounce {
          0%, 100% { opacity: 0.7; transform: translateY(0) scale(1); }
          50%      { opacity: 1;   transform: translateY(-4px) scale(1.15); }
        }
      `}</style>
    </div>,
    document.body
  );
}
