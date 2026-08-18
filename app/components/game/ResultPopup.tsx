"use client";

import { asset } from "../../lib/cdn";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { formatINR } from "../../lib/format";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import type { ResultChip } from "./resultChips";
import { wingoResultChips } from "./resultChips";

export interface ResultPopupProps {
  open: boolean;
  isWin: boolean;
  /**
   * Explicit game-specific chips. Preferred for K3 / 5D / Moto.
   * If omitted, WinGo-style color/number/size is derived from legacy props.
   */
  chips?: ResultChip[] | null;
  /** Section title above chips */
  resultsHeading?: string | null;
  /** @deprecated Prefer `chips` — kept for WinGo callers */
  resultNumber?: number | null;
  resultColor?: string | null;
  resultSize?: string | null;
  winAmount?: number;
  /** Full game + duration label, e.g. "WinGo 30sec", "K3 1 Min" */
  periodLabel?: string;
  periodNumber?: string | null;
  autoCloseMs?: number;
  onClose: () => void;
}

/**
 * Zones measured from winningpopup.png (1186×1624):
 *  - Medal/ribbon: ~0–24%
 *  - Orange body (title + results): ~25–58%
 *  - Paper ticket: ~62–79%  (x ~15–85%)
 *  - Footer red: ~80–96%
 * Loss frame paper is ~55–78% — still covers 63–76% ticket box.
 */

/** Sparkle positions around the win medal / body (% of frame) */
const WIN_SPARKLES: {
  top: string;
  left: string;
  size: number;
  delay: string;
  float?: boolean;
}[] = [
  { top: "6%", left: "18%", size: 11, delay: "0s", float: true },
  { top: "4%", left: "72%", size: 13, delay: "0.15s", float: true },
  { top: "14%", left: "8%", size: 9, delay: "0.35s" },
  { top: "12%", left: "88%", size: 10, delay: "0.5s" },
  { top: "22%", left: "14%", size: 12, delay: "0.2s", float: true },
  { top: "20%", left: "82%", size: 11, delay: "0.4s", float: true },
  { top: "30%", left: "6%", size: 8, delay: "0.65s" },
  { top: "28%", left: "92%", size: 9, delay: "0.8s" },
  { top: "38%", left: "10%", size: 10, delay: "0.25s", float: true },
  { top: "36%", left: "86%", size: 12, delay: "0.55s", float: true },
  { top: "48%", left: "12%", size: 9, delay: "0.7s" },
  { top: "46%", left: "84%", size: 10, delay: "0.9s" },
  { top: "8%", left: "48%", size: 14, delay: "0.1s", float: true },
  { top: "18%", left: "42%", size: 8, delay: "0.45s" },
  { top: "16%", left: "58%", size: 9, delay: "0.6s" },
  { top: "42%", left: "48%", size: 11, delay: "0.3s", float: true },
];

function SparkleIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 1.5l1.8 6.2L20 9.5l-6.2 1.8L12 17.5l-1.8-6.2L4 9.5l6.2-1.8L12 1.5z" />
      <path
        d="M19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6L15.5 17.5l2.6-.9L19 14z"
        opacity="0.9"
      />
    </svg>
  );
}

const PARTY_COLORS = [
  "#FED358",
  "#FF6B6B",
  "#4ADE80",
  "#60A5FA",
  "#F472B6",
  "#A78BFA",
  "#FBBF24",
  "#FB923C",
  "#FFFFFF",
  "#2DD4BF",
] as const;

type PartyShape = "rect" | "sq" | "dot" | "ribbon";
const PARTY_SHAPES: PartyShape[] = ["rect", "sq", "dot", "ribbon"];

type PartyBit = {
  key: string;
  mode: "fly" | "fall";
  top: string;
  left: string;
  color: string;
  shape: PartyShape;
  dx: string;
  dy: string;
  rot: string;
  delay: string;
  duration: string;
};

/** Full-viewport party confetti — bursts + rain (birthday “peeeep”) */
function buildPartyBits(): PartyBit[] {
  const bits: PartyBit[] = [];

  // Left popper → center-right / up
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const dx = 40 + t * 160 + (i % 4) * 12;
    const dy = -30 - t * 120 - (i % 5) * 18;
    bits.push({
      key: `L-${i}`,
      mode: "fly",
      top: "38%",
      left: "6%",
      color: PARTY_COLORS[i % PARTY_COLORS.length]!,
      shape: PARTY_SHAPES[i % PARTY_SHAPES.length]!,
      dx: `${dx}px`,
      dy: `${dy}px`,
      rot: `${180 + i * 25}deg`,
      delay: `${(i % 8) * 0.05}s`,
      duration: `${1.55 + (i % 4) * 0.15}s`,
    });
  }

  // Right popper → center-left / up
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const dx = -(40 + t * 160 + (i % 4) * 12);
    const dy = -30 - t * 120 - (i % 5) * 18;
    bits.push({
      key: `R-${i}`,
      mode: "fly",
      top: "38%",
      left: "90%",
      color: PARTY_COLORS[(i + 2) % PARTY_COLORS.length]!,
      shape: PARTY_SHAPES[(i + 1) % PARTY_SHAPES.length]!,
      dx: `${dx}px`,
      dy: `${dy}px`,
      rot: `${-180 - i * 25}deg`,
      delay: `${0.04 + (i % 8) * 0.05}s`,
      duration: `${1.55 + (i % 4) * 0.15}s`,
    });
  }

  // Top rain (classic birthday confetti fall)
  for (let i = 0; i < 24; i++) {
    bits.push({
      key: `F-${i}`,
      mode: "fall",
      top: `${-2 - (i % 6) * 3}%`,
      left: `${4 + (i * 4.1) % 92}%`,
      color: PARTY_COLORS[(i + 4) % PARTY_COLORS.length]!,
      shape: PARTY_SHAPES[i % PARTY_SHAPES.length]!,
      dx: `${(i % 2 === 0 ? 1 : -1) * (20 + (i % 7) * 8)}px`,
      dy: "110vh",
      rot: `${(i % 2 === 0 ? 1 : -1) * (280 + i * 17)}deg`,
      delay: `${(i % 12) * 0.08}s`,
      duration: `${2.1 + (i % 5) * 0.2}s`,
    });
  }

  return bits;
}

const PARTY_BITS = buildPartyBits();

function PartyConfetti() {
  return (
    <div className="win-party-fullscreen" aria-hidden>
      {PARTY_BITS.map((b) => (
        <span
          key={b.key}
          className={`win-party-bit win-party-bit--${b.shape} win-party-bit--${b.mode}`}
          style={
            {
              top: b.top,
              left: b.left,
              backgroundColor: b.color,
              animationDelay: b.delay,
              animationDuration: b.duration,
              // CSS custom props for keyframes
              ["--c-dx" as string]: b.dx,
              ["--c-dy" as string]: b.dy,
              ["--c-rot" as string]: b.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function ResultPopup({
  open,
  isWin,
  chips,
  resultsHeading,
  resultNumber,
  resultColor,
  resultSize,
  winAmount = 0,
  periodLabel,
  periodNumber,
  autoCloseMs = 3000,
  onClose,
}: ResultPopupProps) {
  const [left, setLeft] = useState(Math.max(1, Math.ceil(autoCloseMs / 1000)));
  const onCloseRef = useRef(onClose);
  const closedRef = useRef(false);

  useSpaBackClose(open, onClose, "result-popup");
  useBodyScrollLock(open);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      closedRef.current = false;
      return;
    }
    closedRef.current = false;
    setLeft(Math.max(1, Math.ceil(autoCloseMs / 1000)));
    const start = Date.now();

    const tick = window.setInterval(() => {
      const remainMs = Math.max(0, autoCloseMs - (Date.now() - start));
      setLeft(Math.max(0, Math.ceil(remainMs / 1000)));
      if (remainMs <= 0 && !closedRef.current) {
        closedRef.current = true;
        window.clearInterval(tick);
        onCloseRef.current();
      }
    }, 100);

    const hard = window.setTimeout(() => {
      if (!closedRef.current) {
        closedRef.current = true;
        onCloseRef.current();
      }
    }, autoCloseMs + 150);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hard);
    };
  }, [open, autoCloseMs]);

  if (!open) return null;

  // Only render chips for this game — never invent WinGo color for other titles
  const displayChips: ResultChip[] =
    chips && chips.length > 0
      ? chips
      : wingoResultChips({ resultNumber, resultColor, resultSize });

  const heading =
    resultsHeading?.trim() ||
    (chips && chips.length > 0 ? "Results" : "Lottery results");

  const frameSrc = isWin
    ? asset("/assets/png/popups/winningpopup.png")
    : asset("/assets/png/popups/losspopup.png");

  const titleColor = isWin ? "#FFF8E8" : "#F4F7FC";
  const resultsLabel = isWin ? "rgba(255,248,232,0.95)" : "rgba(244,247,252,0.95)";
  const ticketBonus = isWin ? "#C47A18" : "#7A8BA8";
  const ticketAmount = isWin ? "#D97706" : "#64748b";
  const ticketPeriod = isWin ? "#C8922A" : "#7A8BA8";
  const footerText = "#FFFFFF";
  const checkStroke = isWin ? "#E87820" : "#7A8BA8";

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current();
  };

  const periodDisplay =
    periodLabel != null && String(periodLabel).trim() !== ""
      ? `Period: ${periodLabel}`
      : "Period";

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={isWin ? "You won" : "You lost"}
    >
      {/* Full-screen party confetti — above dim, around popup (wins only) */}
      {isWin ? <PartyConfetti /> : null}

      <div
        className="relative z-[146] w-full max-w-[300px] animate-[fadeIn_0.35s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Same aspect as asset so % tops map 1:1 to art (no letterbox drift) */}
        <div
          className="relative w-full overflow-visible"
          style={{ aspectRatio: "1186 / 1624" }}
        >
          <Image
            src={frameSrc}
            alt=""
            fill
            sizes="300px"
            className="object-fill pointer-events-none select-none"
            priority
          />

          {/* Win-only: glow + sparkles on the card */}
          {isWin && (
            <>
              <div className="win-glow-ring" aria-hidden />
              {WIN_SPARKLES.map((sp, i) => (
                <span
                  key={i}
                  className={
                    sp.float ? "win-sparkle win-sparkle--float" : "win-sparkle"
                  }
                  style={{
                    top: sp.top,
                    left: sp.left,
                    animationDelay: sp.delay,
                    color:
                      i % 3 === 0
                        ? "#FFF4C4"
                        : i % 3 === 1
                          ? "#FED358"
                          : "#FFB472",
                  }}
                  aria-hidden
                >
                  <SparkleIcon size={sp.size} />
                </span>
              ))}
            </>
          )}

          {/* ── Title (orange body, under medal) ── */}
          <div
            className="absolute left-0 right-0 flex items-center justify-center px-[12%]"
            style={{ top: "27%", height: "7%" }}
          >
            <h2
              className="text-center font-black tracking-wide leading-none"
              style={{
                color: titleColor,
                fontSize: "clamp(17px, 5.4vw, 21px)",
                textShadow: isWin
                  ? "0 1px 0 rgba(160,60,20,0.28)"
                  : "0 1px 0 rgba(70,90,120,0.22)",
              }}
            >
              {isWin ? "Congratulations" : "Sorry"}
            </h2>
          </div>

          {/* ── Game-specific result chips only ── */}
          <div
            className="absolute left-[6%] right-[6%] flex flex-wrap items-center justify-center gap-1 content-center"
            style={{ top: "34%", height: "9%" }}
          >
            <span
              className="text-[10px] font-semibold whitespace-nowrap leading-none w-full text-center mb-0.5"
              style={{ color: resultsLabel }}
            >
              {heading}
            </span>
            {displayChips.map((chip, i) => (
              <span
                key={`${chip.text}-${i}`}
                className="px-1.5 py-[3px] rounded-[4px] text-[10px] font-bold text-white leading-none max-w-[48%] truncate"
                style={{
                  background: chip.bg ?? "rgba(0,0,0,0.4)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                }}
                title={chip.text}
              >
                {chip.text}
              </span>
            ))}
          </div>

          {/* ── Ticket paper (measured 62–79% win / 55–78% loss) ── */}
          <div
            className="absolute flex flex-col items-center justify-center text-center"
            style={{
              top: "63%",
              height: "15%",
              left: "16%",
              right: "16%",
            }}
          >
            {isWin ? (
              <>
                <p
                  className="text-[12px] font-bold leading-none"
                  style={{ color: ticketBonus }}
                >
                  Bonus
                </p>
                <p
                  className="mt-1 text-[22px] font-black tabular-nums leading-none"
                  style={{ color: ticketAmount }}
                >
                  {formatINR(winAmount)}
                </p>
              </>
            ) : (
              <p
                className="text-[26px] font-black tracking-wide leading-none"
                style={{ color: "#94A3B8" }}
              >
                Lose
              </p>
            )}
            <p
              className="mt-1.5 text-[10px] font-medium leading-snug"
              style={{ color: ticketPeriod }}
            >
              {periodDisplay}
              {periodNumber ? (
                <>
                  <br />
                  <span className="font-mono text-[10px] tracking-tight">
                    {periodNumber}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          {/* ── Footer under paper (red/blue shell ~82–90%) ── */}
          <div
            className="absolute left-0 right-0 flex items-center justify-center gap-1.5 select-none"
            style={{ top: "84%", height: "5%" }}
          >
            <span
              className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full"
              style={{
                background: "#FFFFFF",
                boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
              }}
              aria-hidden
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.2L5 8.7L9.5 3.5"
                  stroke={checkStroke}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums leading-none"
              style={{ color: footerText }}
            >
              {left} seconds auto close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
