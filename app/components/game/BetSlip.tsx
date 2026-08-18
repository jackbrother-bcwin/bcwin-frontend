"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { formatINR } from "../../lib/format";

/** 0 = violet+red · 5 = violet+green · even red · odd green (matches NumberBall) */
function numberBallBg(n: number): string {
  if (n === 0) return "linear-gradient(135deg,#9B48DB 50%,#DA3735 50%)";
  if (n === 5) return "linear-gradient(135deg,#9B48DB 50%,#17B15E 50%)";
  if (n % 2 === 1) return "#17B15E";
  return "#DA3735";
}

export type BetSlipTheme = "red" | "green" | "violet" | "orange" | "blue";

const THEME: Record<
  BetSlipTheme,
  { header: string; accent: string; soft: string; btn: string; chip: string }
> = {
  red: {
    header: "linear-gradient(180deg,#ff6b6b 0%,#e11d48 55%,#be123c 100%)",
    accent: "#e11d48",
    soft: "#fff1f2",
    btn: "linear-gradient(180deg,#ff5a5f 0%,#e11d48 100%)",
    chip: "#e11d48",
  },
  green: {
    header: "linear-gradient(180deg,#4ade80 0%,#16a34a 55%,#15803d 100%)",
    accent: "#16a34a",
    soft: "#f0fdf4",
    btn: "linear-gradient(180deg,#22c55e 0%,#16a34a 100%)",
    chip: "#16a34a",
  },
  violet: {
    header: "linear-gradient(180deg,#c084fc 0%,#9333ea 55%,#7e22ce 100%)",
    accent: "#9333ea",
    soft: "#faf5ff",
    btn: "linear-gradient(180deg,#a855f7 0%,#7e22ce 100%)",
    chip: "#9333ea",
  },
  orange: {
    header: "linear-gradient(180deg,#fdba74 0%,#f97316 55%,#ea580c 100%)",
    accent: "#f97316",
    soft: "#fff7ed",
    btn: "linear-gradient(180deg,#fb923c 0%,#ea580c 100%)",
    chip: "#f97316",
  },
  blue: {
    header: "linear-gradient(180deg,#7dd3fc 0%,#3b82f6 55%,#2563eb 100%)",
    accent: "#2563eb",
    soft: "#eff6ff",
    btn: "linear-gradient(180deg,#60a5fa 0%,#2563eb 100%)",
    chip: "#2563eb",
  },
};

/** Must match `.bet-sheet-panel` / `bet-sheet-down` duration. */
const SLIP_EXIT_MS = 360;

const AMOUNTS = [1, 10, 100, 1000, 10000];
/** Quantity presets only (not a second stake multiplier) — ADR-0014 */
const QTY_PRESETS = [1, 3, 9, 27, 81, 243, 729] as const;
const QTY_MIN = 1;

export function themeFromBet(
  betType: string,
  betChoice: string
): BetSlipTheme {
  const t = betType.toUpperCase();
  const c = betChoice.toUpperCase();
  if (t === "COLOR") {
    if (c === "GREEN") return "green";
    if (c === "VIOLET") return "violet";
    return "red";
  }
  if (t === "SIZE") {
    if (c === "BIG") return "orange";
    return "blue";
  }
  // NUMBER
  const n = Number(betChoice);
  if (n === 0 || n === 5) return "violet";
  if ([1, 3, 7, 9].includes(n)) return "green";
  return "red";
}

export interface BetSlipConfirmPayload {
  baseAmount: number;
  /** Number of units (also driven by X1…X729 presets) */
  quantity: number;
  /**
   * Always 1 after ADR-0014 — X chips no longer multiply.
   * Kept so callers that read `multiplier` stay safe.
   */
  multiplier: number;
  /** baseAmount × quantity */
  total: number;
}

interface BetSlipProps {
  open: boolean;
  /** e.g. WinGo 1 Min / minute1 */
  gameTitle: string;
  /** e.g. Choose green / Choose Big */
  choiceLabel: string;
  /** Show ball when betting on a number */
  ballNumber?: number | null;
  theme?: BetSlipTheme;
  betting?: boolean;
  balance?: number;
  periodNumber?: string | null;
  initialMultiplier?: number;
  onCancel: () => void;
  onConfirm: (payload: BetSlipConfirmPayload) => void;
  onRules?: () => void;
}

/**
 * Production bet sheet:
 * amount chips + quantity ± + X1…X729 as **quantity presets** (not a 2nd mult).
 * Total = amount × quantity (ADR-0014).
 */
export default function BetSlip({
  open,
  gameTitle,
  choiceLabel,
  ballNumber,
  theme: themeProp,
  betting,
  balance,
  periodNumber,
  initialMultiplier = 1,
  onCancel,
  onConfirm,
  onRules,
}: BetSlipProps) {
  const [base, setBase] = useState(1);
  const [qty, setQty] = useState<number | string>(1);
  const [agree, setAgree] = useState(true);

  const clampQty = (n: number) =>
    Math.max(QTY_MIN, Math.floor(n) || QTY_MIN);

  const parsedQty = typeof qty === "number" ? qty : parseInt(qty, 10);
  const validQty = Math.max(QTY_MIN, Number.isNaN(parsedQty) ? QTY_MIN : parsedQty);

  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const shownRef = useRef(open);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Keep last paint so parent clearing the bet does not flash default red. */
  const [paint, setPaint] = useState({
    theme: themeProp ?? "red",
    gameTitle,
    choiceLabel,
    ballNumber,
  });

  const theme = paint.theme;
  const t = THEME[theme];

  useSpaBackClose(shown && !leaving, onCancel, "bet-slip");
  useBodyScrollLock(shown);

  useEffect(() => {
    if (!open) return;
    setPaint({
      theme: themeProp ?? "red",
      gameTitle,
      choiceLabel,
      ballNumber,
    });
  }, [open, themeProp, gameTitle, choiceLabel, ballNumber]);

  // Slide down then unmount when parent sets open=false (optimistic dismiss).
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const clearInline = () => {
      if (overlay) {
        overlay.style.animation = "";
        overlay.style.opacity = "";
        overlay.style.transition = "";
      }
      if (panel) {
        panel.style.animation = "";
        panel.style.transform = "";
        panel.style.transition = "";
      }
    };

    if (open) {
      shownRef.current = true;
      setShown(true);
      setLeaving(false);
      clearInline();
      return;
    }
    if (!shownRef.current) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      shownRef.current = false;
      setShown(false);
      setLeaving(false);
      return;
    }
    setLeaving(true);
    // Kill enter keyframes so they cannot pin translateY(0) over the exit.
    if (overlay) {
      overlay.style.animation = "none";
      overlay.style.opacity = "1";
    }
    if (panel) {
      panel.style.animation = "none";
      panel.style.transform = "translate3d(0, 0, 0)";
    }
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (overlay) {
          overlay.style.transition = "opacity 0.28s ease-in";
          overlay.style.opacity = "0";
        }
        if (panel) {
          panel.style.transition = `transform ${SLIP_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          panel.style.transform = "translate3d(0, 100%, 0)";
        }
      });
    });
    const t = window.setTimeout(() => {
      shownRef.current = false;
      setShown(false);
      setLeaving(false);
      clearInline();
    }, SLIP_EXIT_MS);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(t);
    };
  }, [open]);

  // Reset when opening a new choice
  useEffect(() => {
    if (open) {
      setBase(1);
      // initialMultiplier historically meant X chip; treat as initial quantity preset
      const init = clampQty(Number(initialMultiplier) || 1);
      setQty(init);
      setAgree(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clampQty stable
  }, [open, choiceLabel, ballNumber, initialMultiplier]);

  /** Stake = amount × quantity only (X chips only set quantity) */
  const total = useMemo(
    () => base * (Number.isNaN(parsedQty) ? 0 : Math.max(0, parsedQty)),
    [base, parsedQty]
  );

  if (!shown) return null;

  const canSubmit = agree && total > 0 && !betting && !leaving;

  return (
    <div
      ref={overlayRef}
      className={`spa-sheet-backdrop bet-sheet-overlay flex items-end justify-center${leaving ? " is-leaving" : ""}`}
      style={{
        background: "rgba(0,0,0,0.55)",
        zIndex: 220,
        pointerEvents: leaving ? "none" : undefined,
      }}
      onClick={() => !betting && !leaving && onCancel()}
      onTouchMove={(e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest?.(".bet-sheet-panel")) return;
        e.preventDefault();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Place bet"
    >
      {/*
        Do NOT use .app-fixed-chrome here — its translateX(-50%) fights
        slide-up transform and looks like a right→left jitter.
        Parent flex centers; sheet animates translateY only.
      */}
      <div
        ref={panelRef}
        className={`bet-sheet-panel relative w-full max-w-[430px]${leaving ? " is-leaving" : ""}`}
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored ribbon header */}
        <div
          className="relative px-4 pt-4 pb-10 text-center text-white rounded-t-[22px]"
          style={{
            background: t.header,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div
            className="absolute left-0 right-0 -bottom-3 h-6"
            style={{
              background: t.header,
              clipPath: "polygon(0 0, 50% 100%, 100% 0)",
              opacity: 0.35,
            }}
          />
          <p className="text-[15px] font-extrabold tracking-wide drop-shadow-sm">
            ◆ {paint.gameTitle} ◆
          </p>
        </div>

        {/* White body overlapping header */}
        <div
          className="relative -mt-2 rounded-t-[20px] bg-white px-4 pt-5 pb-4"
          style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
        >
          {/* Choice display */}
          <div className="flex flex-col items-center mb-4">
            {paint.ballNumber != null && !Number.isNaN(Number(paint.ballNumber)) ? (
              <div
                className="relative mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full"
                style={{
                  background: numberBallBg(Number(paint.ballNumber)),
                  boxShadow:
                    "0 4px 14px rgba(0,0,0,0.35), inset 0 -4px 6px rgba(0,0,0,0.25), inset 0 3px 6px rgba(255,255,255,0.35)",
                }}
              >
                <span
                  className="pointer-events-none absolute left-[14%] top-[10%] h-[32%] w-[42%] rounded-full"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)",
                  }}
                  aria-hidden
                />
                <span
                  className="relative z-[1] text-[30px] font-black tabular-nums text-white"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
                >
                  {paint.ballNumber}
                </span>
              </div>
            ) : (
              <div
                className="mb-2 px-5 py-2 rounded-xl text-[16px] font-extrabold text-white shadow-md"
                style={{ background: t.btn }}
              >
                {paint.choiceLabel}
              </div>
            )}
            {paint.ballNumber == null && (
              <p className="text-[13px] font-bold text-slate-500">{paint.choiceLabel}</p>
            )}
            {periodNumber && (
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                Period {periodNumber}
              </p>
            )}
          </div>

          {/* Currency */}
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[13px] font-semibold text-slate-600">Currency</span>
            <div className="flex items-center gap-4 text-[13px] font-bold">
              <span className="flex items-center gap-1.5" style={{ color: t.accent }}>
                <span
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: t.accent }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: t.accent }} />
                </span>
                INR
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-4 h-4 rounded-full border-2 border-slate-300" />
                USDT
              </span>
            </div>
          </div>

          {/* Amount chips */}
          <div className="flex items-center gap-2 mb-3.5">
            <span className="text-[13px] font-semibold text-slate-600 w-14 shrink-0">Amount</span>
            <div className="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
              {AMOUNTS.map((a) => {
                const on = base === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setBase(a)}
                    className="shrink-0 min-w-[40px] h-8 px-2.5 rounded-full text-[12px] font-bold transition-all active:scale-95"
                    style={{
                      background: on ? t.chip : "#f1f5f9",
                      color: on ? "#fff" : "#64748b",
                      boxShadow: on ? `0 2px 8px ${t.chip}55` : "none",
                    }}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity — source of truth for unit count */}
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[13px] font-semibold text-slate-600">Quantity</span>
            <div className="flex items-center gap-0 rounded-full overflow-hidden border border-slate-200">
              <button
                type="button"
                onClick={() =>
                  setQty((q) => {
                    const current = typeof q === "number" ? q : parseInt(q, 10) || QTY_MIN;
                    return clampQty(current - 1);
                  })
                }
                className="w-9 h-9 text-lg font-bold text-white active:opacity-90"
                style={{ background: t.chip }}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                min={QTY_MIN}
                value={qty}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setQty("");
                    return;
                  }
                  const num = parseInt(val, 10);
                  if (!Number.isNaN(num)) {
                    setQty(Math.max(0, num));
                  }
                }}
                onBlur={() => {
                  setQty((q) => {
                    const num = typeof q === "number" ? q : parseInt(q, 10);
                    return clampQty(num);
                  });
                }}
                className="w-16 sm:w-20 h-9 text-center text-[14px] font-bold text-slate-900 outline-none bg-white border-x border-slate-200 tabular-nums px-1"
              />
              <button
                type="button"
                onClick={() =>
                  setQty((q) => {
                    const current = typeof q === "number" ? q : parseInt(q, 10) || QTY_MIN;
                    return clampQty(current + 1);
                  })
                }
                className="w-9 h-9 text-lg font-bold text-white active:opacity-90"
                style={{ background: t.chip }}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* X1 X3 X9… — quantity presets (highlight only when qty equals preset) */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">
            {QTY_PRESETS.map((preset) => {
              const on = validQty === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setQty(preset)}
                  className="shrink-0 h-8 min-w-[42px] px-2 rounded-md text-[12px] font-bold transition-all active:scale-95"
                  style={{
                    background: on ? t.chip : "#f1f5f9",
                    color: on ? "#fff" : "#94a3b8",
                  }}
                  aria-pressed={on}
                  aria-label={`Set quantity to ${preset}`}
                >
                  X{preset}
                </button>
              );
            })}
          </div>

          {/* Agree */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setAgree((a) => !a)}
              className="w-5 h-5 rounded flex items-center justify-center shrink-0"
              style={{
                background: agree ? t.chip : "#fff",
                border: `2px solid ${agree ? t.chip : "#cbd5e1"}`,
              }}
              aria-pressed={agree}
            >
              {agree && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <span className="text-[12px] text-slate-600 font-medium">I agree</span>
            <button
              type="button"
              onClick={onRules}
              className="text-[12px] font-bold ml-1"
              style={{ color: t.accent }}
            >
              Pre-sale rules
            </button>
            {balance != null && (
              <span className="ml-auto text-[10px] text-slate-400 tabular-nums">
                Bal {formatINR(balance)}
              </span>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex gap-0 -mx-4 -mb-4 overflow-hidden rounded-b-[4px]">
            <button
              type="button"
              disabled={betting}
              onClick={onCancel}
              className="flex-1 h-[50px] text-[15px] font-bold text-slate-500 bg-slate-100 active:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                if (leaving) return;
                const finalQty = clampQty(typeof qty === "number" ? qty : parseInt(qty, 10) || QTY_MIN);
                onConfirm({
                  baseAmount: base,
                  quantity: finalQty,
                  multiplier: 1,
                  total: base * finalQty,
                });
              }}
              className="flex-[1.35] h-[50px] text-[15px] font-extrabold text-white disabled:opacity-50 active:opacity-90"
              style={{ background: t.btn }}
            >
              {betting ? "Placing…" : `Total amount ${total.toLocaleString("en-IN")}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
