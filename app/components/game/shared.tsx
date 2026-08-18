"use client";

import { asset } from "../../lib/cdn";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { IoVolumeHigh, IoVolumeMute } from "react-icons/io5";
import { formatINR } from "../../lib/format";
import {
  initCountdownAudioMute,
  playCountdownBeep,
  preloadCountdownAudio,
  resetCountdownAudio,
  subscribeCountdownMute,
  toggleCountdownMuted,
} from "../../lib/countdown-audio";
import BetSlip, { type BetSlipConfirmPayload, type BetSlipTheme } from "./BetSlip";
export type { BetSlipConfirmPayload, BetSlipTheme };
export { default as BetSlip } from "./BetSlip";
export { default as ResultPopup } from "./ResultPopup";

/* ── Ball assets (ts777 / WinGo style) ── */
export const BALL_SRC: Record<number, string> = {
  0: asset("/assets/png/ball_0-053d2b99.webp"),
  1: asset("/assets/png/ball_1-6bd610b3.webp"),
  2: asset("/assets/png/ball_2-b101eb0b.webp"),
  3: asset("/assets/png/ball_3-4f525185.webp"),
  4: asset("/assets/png/ball_4-93baf748.webp"),
  5: asset("/assets/png/ball_5-726eaa52.webp"),
  6: asset("/assets/png/ball_6-56155f8b.webp"),
  7: asset("/assets/png/ball_7-a1b324d5.webp"),
  8: asset("/assets/png/ball_8-ea96e5f4.webp"),
  9: asset("/assets/png/ball_9-9160f2ef.webp"),
};

/**
 * WinGo number colors:
 * - 0 = violet + red
 * - 5 = violet + green
 * - even (2,4,6,8) = red
 * - odd (1,3,7,9) = green
 */
export const NUM_COLOR: Record<number, { primary: string; gradient?: string }> = {
  0: { primary: "#9B48DB", gradient: "135deg, #9B48DB 50%, #DA3735 50%" },
  1: { primary: "#17B15E" },
  2: { primary: "#DA3735" },
  3: { primary: "#17B15E" },
  4: { primary: "#DA3735" },
  5: { primary: "#9B48DB", gradient: "135deg, #9B48DB 50%, #17B15E 50%" },
  6: { primary: "#DA3735" },
  7: { primary: "#17B15E" },
  8: { primary: "#DA3735" },
  9: { primary: "#17B15E" },
};

export function numberColors(n: number): ("green" | "red" | "violet")[] {
  if (n === 0) return ["violet", "red"];
  if (n === 5) return ["violet", "green"];
  if (n % 2 === 1) return ["green"]; // odd
  return ["red"]; // even
}

/** Primary text/fill color for a result number (0/5 use dual-friendly primary) */
export function numberPrimaryColor(n: number): string {
  if (n === 0) return "#9B48DB";
  if (n === 5) return "#9B48DB";
  return n % 2 === 1 ? "#17B15E" : "#DA3735";
}

/** CSS background for number chips (matches balls) */
export function numberBackground(n: number): string {
  const cfg = NUM_COLOR[n];
  if (!cfg) return "#837064";
  return cfg.gradient ? `linear-gradient(${cfg.gradient})` : cfg.primary;
}

export function isBig(n: number): boolean {
  return n >= 5;
}

/**
 * Big / Small button colors (NOT red/green — those are color bets only).
 * Matches the WinGo Big/Small strip buttons.
 */
export const SIZE_STYLE = {
  big: {
    bg: "linear-gradient(180deg,#FFB472,#DD9138)",
    solid: "#DD9138",
    text: "#FFFFFF",
  },
  small: {
    bg: "linear-gradient(180deg,#6ba3e8,#5088D3)",
    solid: "#5088D3",
    text: "#FFFFFF",
  },
} as const;

export function sizeStyle(isBigResult: boolean) {
  return isBigResult ? SIZE_STYLE.big : SIZE_STYLE.small;
}

/**
 * Seconds before period end when betting locks.
 * 30s game → last 5s · all longer games → last 10s
 */
export function betLockSeconds(durationSeconds: number): number {
  if (durationSeconds <= 30) return 5;
  return 10;
}

/** True when bets must not be accepted (includes countdown === 0). */
export function isBettingLocked(countdown: number, durationSeconds: number): boolean {
  return countdown <= betLockSeconds(durationSeconds);
}

export const COLOR_DOT: Record<string, string> = {
  green: "#17B15E",
  red: "#DA3735",
  violet: "#9B48DB",
};

/**
 * Number ball with correct WinGo colors (CSS, not asset tints):
 * odd=green · even=red · 0=violet|red · 5=violet|green
 */
export function NumberBall({
  num,
  size = 52,
  className = "",
}: {
  num: number;
  size?: number;
  className?: string;
}) {
  const n = ((num % 10) + 10) % 10; // 0–9
  const fontSize = Math.max(10, size * 0.44);

  let bg = "#17B15E";
  if (n === 0) bg = "linear-gradient(135deg, #9B48DB 50%, #DA3735 50%)";
  else if (n === 5) bg = "linear-gradient(135deg, #9B48DB 50%, #17B15E 50%)";
  else if (n % 2 === 0) bg = "#DA3735";
  else bg = "#17B15E";

  return (
    <div
      className={`relative flex items-center justify-center rounded-full select-none shrink-0 overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        boxShadow: `0 3px 8px rgba(0,0,0,0.4), inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -2px 4px rgba(0,0,0,0.35)`,
      }}
      aria-label={`Number ${n}`}
    >
      {/* Top gloss arc */}
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          top: "-25%",
          left: "10%",
          width: "80%",
          height: "45%",
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.1) 70%, transparent 100%)",
        }}
        aria-hidden
      />
      <span
        className="relative z-[1] font-black text-white tabular-nums leading-none flex items-center justify-center"
        style={{
          fontSize,
          textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        }}
      >
        {n}
      </span>
    </div>
  );
}

export function ColorDots({ num, size = 8 }: { num: number; size?: number }) {
  const colors = numberColors(num);
  return (
    <span className="inline-flex items-center gap-0.5 justify-center">
      {colors.map((c) => (
        <span
          key={c}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: COLOR_DOT[c],
            boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}
        />
      ))}
    </span>
  );
}

export function CountdownDigit({ digit, large }: { digit: string; large?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center font-black leading-none rounded-[3px] ${
        large ? "w-[24px] h-[30px] text-[20px]" : "w-[20px] h-[26px] text-[18px]"
      }`}
      style={{
        background: "#110D14",
        color: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}
    >
      {digit}
    </div>
  );
}

export function CountdownDisplay({ seconds }: { seconds: number }) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const a = String(m).padStart(2, "0");
  const b = String(r).padStart(2, "0");
  return (
    <div className="flex items-center gap-[3px]">
      <CountdownDigit digit={a[0]!} />
      <CountdownDigit digit={a[1]!} />
      <span className="text-[#110D14] text-[18px] font-black leading-none mx-0.5">:</span>
      <CountdownDigit digit={b[0]!} />
      <CountdownDigit digit={b[1]!} />
    </div>
  );
}

/**
 * Huge 05→00 overlay when countdown is in the last few seconds.
 * Plays warning SFX each second (5–1) and zero SFX at 00 — all games share this.
 */
export function CountdownPopout({ seconds }: { seconds: number }) {
  const s = Math.floor(seconds);
  /** Hide sticky 00 after a short beat so settle gap never freezes the overlay */
  const [hideZero, setHideZero] = useState(false);

  useEffect(() => {
    preloadCountdownAudio();
    return () => {
      resetCountdownAudio();
    };
  }, []);

  useEffect(() => {
    if (s > 5 || s < 0) return;
    playCountdownBeep(s);
  }, [s]);

  useEffect(() => {
    if (s !== 0) {
      setHideZero(false);
      return;
    }
    // Show 00 briefly for SFX, then clear overlay so UI never looks frozen
    setHideZero(false);
    const t = window.setTimeout(() => setHideZero(true), 1200);
    return () => window.clearTimeout(t);
  }, [s]);

  if (s > 5 || s < 0) return null;
  if (s === 0 && hideZero) return null;
  const display = String(Math.max(0, s)).padStart(2, "0");
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center gap-3.5 sm:gap-5 pointer-events-none animate-[countdown-pulse_1s_ease-in-out_infinite]"
      style={{ background: "transparent" }}
    >
      {[display[0], display[1]].map((d, i) => (
        <div
          key={i}
          className="w-[min(32vw,132px)] h-[min(42vw,176px)] sm:w-[142px] sm:h-[190px] rounded-[18px] sm:rounded-[22px] flex items-center justify-center"
          style={{
            background: "linear-gradient(180deg, #3a3238 0%, #2a2428 100%)",
            boxShadow:
              "0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            border: "1.5px solid rgba(254,211,88,0.28)",
          }}
        >
          <span
            className="font-black leading-none tabular-nums"
            style={{
              fontSize: "clamp(4.75rem, 20vw, 8rem)",
              color: "#FED358",
              textShadow: "0 4px 20px rgba(254,211,88,0.55)",
            }}
          >
            {d}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Music / SFX mute toggle for game headers (react-icons). */
export function GameSoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(initCountdownAudioMute());
    return subscribeCountdownMute(setMuted);
  }, []);

  return (
    <button
      type="button"
      onClick={() => setMuted(toggleCountdownMuted())}
      className="w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-transform"
      style={{
        color: muted ? "rgba(255,255,255,0.45)" : "#FED358",
        background: muted ? "rgba(255,255,255,0.06)" : "rgba(254,211,88,0.12)",
        border: muted
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid rgba(254,211,88,0.35)",
      }}
      aria-label={muted ? "Unmute game sound" : "Mute game sound"}
      aria-pressed={muted}
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? <IoVolumeMute size={20} /> : <IoVolumeHigh size={20} />}
    </button>
  );
}

export function GameHeader({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <>
      <header className="app-page-header app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner">
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center text-white/80 active:opacity-60"
            aria-label="Back"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative w-[110px] h-[32px] shrink-0">
              <Image
                src={asset("/assets/png/bcwin.png")}
                alt="BCWin"
                fill
                sizes="110px"
                className="object-contain"
                priority
              />
            </div>
            {title ? (
              <span className="text-[12px] font-bold text-[#FED358] tracking-wide truncate">
                {title}
              </span>
            ) : null}
          </div>
          <div className="min-w-[70px] h-9 flex items-center justify-end shrink-0 gap-2">
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center text-white/80 active:opacity-60"
              aria-label="Customer service"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            </button>
            {right ?? null}
          </div>
        </div>
      </header>
      <div className="app-page-header-spacer" aria-hidden />
    </>
  );
}

export function GameWalletCard({
  balance,
  onRefresh,
  onWithdraw,
  onDeposit,
}: {
  balance?: number | null;
  onRefresh?: () => void;
  onWithdraw?: () => void;
  onDeposit?: () => void;
}) {
  return (
    <div
      className="mx-3 mt-3 rounded-[16px] overflow-hidden relative"
      style={{
        background: "radial-gradient(circle at 80% 20%, #39304a 0%, #241E28 70%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div className="relative px-5 pt-4 pb-4">
        {/* Balance + Refresh */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-[28px] font-black text-white tracking-tight tabular-nums">
            {formatINR(balance)}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-white/60 active:rotate-180 transition-transform p-1"
            aria-label="Refresh balance"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        {/* Subtitle with Wallet Icon */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <span className="text-[16px]">👛</span>
          <span className="text-[13px] font-medium text-[#FED358]">Wallet balance</span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onWithdraw}
            className="flex-1 h-[42px] rounded-full font-extrabold text-[15px] text-white active:scale-[0.98] transition-transform"
            style={{
              background: "#DA3735",
              boxShadow: "0 3px 12px rgba(218,55,53,0.4)",
            }}
          >
            Withdraw
          </button>
          <button
            type="button"
            onClick={onDeposit}
            className="flex-1 h-[42px] rounded-full font-extrabold text-[15px] text-white active:scale-[0.98] transition-transform"
            style={{
              background: "#17B15E",
              boxShadow: "0 3px 12px rgba(23,177,94,0.4)",
            }}
          >
            Deposit
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameNoticeBar({ text = "Welcome to BCWIN game platform, we will serve you wholeheartedly!" }: { text?: string }) {
  return (
    <div
      className="mx-3 mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        background: "#221d25",
        border: "1px solid rgba(254,211,88,0.4)",
      }}
    >
      <span className="text-[#FED358] shrink-0 text-[16px]" aria-hidden>
        🔊
      </span>
      <div className="flex-1 overflow-hidden min-w-0">
        <p className="text-[12px] font-medium text-[#FDE4BC]/90 whitespace-nowrap animate-marquee">{text}</p>
      </div>
      <button
        type="button"
        className="shrink-0 h-7 px-3.5 rounded-full text-[11px] font-bold text-[#110D14]"
        style={{ background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" }}
      >
        Detail
      </button>
    </div>
  );
}

export type DurationTab = {
  id: string;
  label: string;
  subLabel: string;
  seconds: number;
  icon?: string;
};

export function DurationTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: DurationTab[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mx-3 mt-3 grid grid-cols-4 gap-2">
      {tabs.map((tab) => {
        const active = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-[14px] transition-all active:scale-95"
            style={{
              background: active
                ? "linear-gradient(180deg, #FFDF73 0%, #FFB454 100%)"
                : "#282330",
              border: active ? "1px solid #FFDF73" : "1px solid rgba(255,255,255,0.05)",
              boxShadow: active ? "0 4px 14px rgba(254,211,88,0.3)" : "none",
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: active
                  ? "linear-gradient(180deg, #FFE896 0%, #F5AB35 100%)"
                  : "linear-gradient(180deg, #575263 0%, #3a3545 100%)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? "#110D14" : "#d1c7d8"}
                strokeWidth="2.2"
              >
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 14" />
              </svg>
            </div>
            <span
              className="text-[11px] font-bold leading-tight text-center"
              style={{ color: active ? "#110D14" : "#A195A8" }}
            >
              <span className="block">{tab.label}</span>
              <span className="block text-[10px] opacity-90">{tab.subLabel}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PeriodBanner({
  gameLabel,
  periodNumber,
  countdown,
  recentBalls,
  onHowToPlay,
  blockHashSuffix,
}: {
  gameLabel: string;
  periodNumber?: string | null;
  countdown: number;
  recentBalls: number[];
  onHowToPlay?: () => void;
  blockHashSuffix?: string | null;
}) {
  return (
    <div
      className="mx-3 mt-3 rounded-[14px] relative overflow-hidden shadow-lg"
      style={{
        background: "linear-gradient(135deg, #FFDF73 0%, #FFB454 50%, #FFA83b 100%)",
        boxShadow: "0 4px 16px rgba(254,211,88,0.25)",
      }}
    >
      {/* Ticket notches */}
      <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#110D14] z-10" />
      <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#110D14] z-10" />

      <div className="flex min-h-[96px] items-stretch">
        {/* Left section */}
        <div className="flex-1 pl-4 pr-2 py-3 flex flex-col justify-between min-w-0">
          <button
            type="button"
            onClick={onHowToPlay}
            className="inline-flex items-center gap-1.5 self-start h-6 px-3 rounded-full text-[11px] font-bold text-[#110D14]"
            style={{
              background: "rgba(255,255,255,0.4)",
              border: "1px solid rgba(17,13,20,0.25)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
            </svg>
            How to play
          </button>
          <div>
            <p className="text-[12px] font-bold text-[#110D14] leading-tight mb-1.5">{gameLabel}</p>
            <div className="flex items-center gap-1.5">
              {recentBalls.length > 0
                ? recentBalls.map((n, i) => <NumberBall key={`${n}-${i}`} num={n} size={22} />)
                : Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="w-[22px] h-[22px] rounded-full bg-black/10" />
                  ))}
            </div>
          </div>
        </div>

        {/* Dashed Vertical Divider */}
        <div className="w-0 border-r-2 border-dashed border-[#110D14]/20 my-2" />

        {/* Right section */}
        <div className="flex-1 pr-4 pl-2 py-3 flex flex-col items-end justify-between min-w-0">
          <p className="text-[12px] font-bold text-[#110D14]">Time remaining</p>
          <CountdownDisplay seconds={countdown} />
          <div className="flex flex-col items-end min-w-0 max-w-full">
            <p className="text-[12px] font-mono font-extrabold text-[#110D14] tracking-tight truncate max-w-full">
              {periodNumber ?? "—"}
            </p>
            {blockHashSuffix != null && blockHashSuffix !== "" && (
              <p
                className="text-[10px] font-mono font-bold text-[#110D14]/80 tracking-wide"
                title="Tron block hash (last 5)"
              >
                …{blockHashSuffix}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mx-3 mt-4 flex gap-2">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="flex-1 h-10 rounded-[12px] text-[13px] font-bold transition-all active:scale-[0.98]"
            style={{
              background: isActive
                ? "linear-gradient(180deg, #FFDF73 0%, #FFB454 100%)"
                : "#282330",
              color: isActive ? "#110D14" : "#A195A8",
              border: isActive ? "none" : "1px solid rgba(255,255,255,0.05)",
              boxShadow: isActive ? "0 2px 10px rgba(254,211,88,0.3)" : "none",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Backward-compatible confirm sheet → production BetSlip UI.
 * Parent can ignore payload and keep using its own amount state,
 * or switch to onConfirmTotal for the slip-calculated total.
 */
export function BetConfirmSheet({
  open,
  label,
  amount: _amount,
  periodNumber,
  betting = false,
  onCancel,
  onConfirm,
  onConfirmTotal,
  theme = "orange",
  gameTitle = "Game",
  ballNumber,
  balance,
  initialMultiplier,
  onRules,
}: {
  open: boolean;
  label: string;
  amount?: string;
  periodNumber?: string | null;
  betting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onConfirmTotal?: (payload: BetSlipConfirmPayload) => void;
  theme?: BetSlipTheme;
  gameTitle?: string;
  ballNumber?: number | null;
  balance?: number;
  initialMultiplier?: number;
  onRules?: () => void;
}) {
  return (
    <BetSlip
      open={open}
      gameTitle={gameTitle}
      choiceLabel={label}
      ballNumber={ballNumber}
      theme={theme}
      betting={betting}
      periodNumber={periodNumber}
      balance={balance}
      initialMultiplier={initialMultiplier}
      onCancel={onCancel}
      onRules={onRules}
      onConfirm={(payload) => {
        if (onConfirmTotal) onConfirmTotal(payload);
        else onConfirm();
      }}
    />
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
  alwaysShow,
  maxPages,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  alwaysShow?: boolean;
  /** When set, Next stops at this page even if the API has more. */
  maxPages?: number;
}) {
  const last = Math.max(
    1,
    maxPages != null
      ? Math.min(totalPages || 1, maxPages)
      : totalPages || 1
  );
  const safe = Math.min(Math.max(1, page), last);
  if (!alwaysShow && last <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-3">
      <button
        type="button"
        disabled={safe <= 1}
        onClick={() => onChange(safe - 1)}
        className="w-9 h-9 rounded-lg text-white/50 disabled:opacity-30 font-bold text-lg"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        ‹
      </button>
      <span className="text-white text-[12px] font-bold tabular-nums">
        {safe}/{last}
      </span>
      <button
        type="button"
        disabled={safe >= last}
        onClick={() => onChange(safe + 1)}
        className="w-9 h-9 rounded-lg text-[#110D14] disabled:opacity-30 font-bold text-lg"
        style={{ background: "linear-gradient(180deg, #FED358 0%, #FFB472 100%)" }}
      >
        ›
      </button>
    </div>
  );
}

/**
 * Straight polyline through winning-ball centers (no curves).
 */
export function buildThreadPath(
  pts: { x: number; y: number }[]
): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0]!.x} ${pts[0]!.y}`;
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

/**
 * Chart trend: number grid per period + red thread connecting outcomes.
 * Measures winning ball centers so the line stays locked to the dots.
 */
export function WingoTrendChart({
  rows,
}: {
  rows: { id: string; periodNumber: string; resultNumber: number }[];
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const winRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const [pts, setPts] = React.useState<{ x: number; y: number }[]>([]);
  const [box, setBox] = React.useState({ w: 0, h: 0 });

  const measure = React.useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || rows.length === 0) {
      setPts([]);
      return;
    }
    const wr = wrap.getBoundingClientRect();
    setBox({ w: wr.width, h: wr.height });
    const next: { x: number; y: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const el = winRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next.push({
        x: r.left - wr.left + r.width / 2,
        y: r.top - wr.top + r.height / 2,
      });
    }
    setPts(next);
  }, [rows]);

  React.useLayoutEffect(() => {
    measure();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measure())
        : null;
    ro?.observe(wrap);
    // Fonts / images can shift layout slightly
    const t = window.setTimeout(measure, 50);
    return () => {
      ro?.disconnect();
      window.clearTimeout(t);
    };
  }, [measure, rows]);

  const path = React.useMemo(() => buildThreadPath(pts), [pts]);

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-white/30">No chart data</p>
    );
  }

  return (
    <div ref={wrapRef} className="relative min-w-0">
      {/*
        Hairline red thread BEHIND cells (z-0). Very light so it never competes
        with digits — cells sit opaque on top so numbers stay fully readable.
      */}
      {box.w > 0 && box.h > 0 && pts.length > 1 && (
        <svg
          className="pointer-events-none absolute inset-0 z-0"
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          aria-hidden
        >
          <path
            d={path}
            fill="none"
            stroke="rgba(255, 72, 72, 0.72)"
            strokeWidth={1.15}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {rows.map((row, rowIdx) => (
        <div
          key={row.id}
          className="relative z-[1] grid w-full min-w-0 items-center gap-x-1 border-b border-white/5 py-1.5"
          style={{
            gridTemplateColumns: "minmax(56px, 32%) minmax(0, 1fr) 18px",
          }}
        >
          <span className="min-w-0 truncate font-mono text-[8px] leading-tight text-white/50 sm:text-[9px]">
            {row.periodNumber}
          </span>
          <div className="relative z-[1] grid min-w-0 grid-cols-10 gap-px">
            {Array.from({ length: 10 }, (_, n) => {
              const win = row.resultNumber === n;
              // Opaque fill on every cell so the thread never shows through digits
              const bg = win ? numberBackground(n) : "#1a1519";
              const color = win ? "#fff" : "rgba(255,255,255,0.38)";
              const border = win ? "none" : "1px solid rgba(255,255,255,0.12)";
              return (
                <span
                  key={n}
                  ref={
                    win
                      ? (el) => {
                          winRefs.current[rowIdx] = el;
                        }
                      : undefined
                  }
                  className="relative z-[2] mx-auto flex aspect-square w-full max-w-[20px] items-center justify-center rounded-full text-[8px] font-bold leading-none sm:text-[9px]"
                  style={{
                    background: bg,
                    color,
                    border,
                    isolation: "isolate",
                  }}
                >
                  {n}
                </span>
              );
            })}
          </div>
          <span
            className="relative z-[1] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[8px] font-black text-white sm:text-[9px]"
            style={{
              background: sizeStyle(isBig(row.resultNumber)).bg,
            }}
            title={isBig(row.resultNumber) ? "Big" : "Small"}
          >
            {isBig(row.resultNumber) ? "B" : "S"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Chart statistics for last N wingo results */
export function computeWingoChartStats(results: { resultNumber: number }[], window = 100) {
  const slice = results.slice(0, window);
  const missing: number[] = Array(10).fill(0);
  const frequency: number[] = Array(10).fill(0);
  const maxConsecutive: number[] = Array(10).fill(0);
  const lastSeen: number[] = Array(10).fill(-1);
  const run: number[] = Array(10).fill(0);

  slice.forEach((r, idx) => {
    const n = r.resultNumber;
    if (n < 0 || n > 9) return;
    frequency[n] = (frequency[n] ?? 0) + 1;
    // missing = distance from most recent result (idx 0)
    if (lastSeen[n] === -1) lastSeen[n] = idx;
    // consecutive from start of window going forward in time (newest first)
    if (idx === 0 || (slice[idx - 1]?.resultNumber === n)) {
      run[n] = (run[n] ?? 0) + 1;
    } else {
      run[n] = r.resultNumber === n ? 1 : (run[n] ?? 0);
    }
  });

  // recompute consecutive properly (streaks of same number in chronological reverse)
  for (let n = 0; n < 10; n++) {
    let best = 0;
    let cur = 0;
    for (const r of slice) {
      if (r.resultNumber === n) {
        cur += 1;
        best = Math.max(best, cur);
      } else {
        cur = 0;
      }
    }
    maxConsecutive[n] = best;
    missing[n] = lastSeen[n] === -1 ? slice.length : lastSeen[n]!;
  }

  // avg missing: average gap between appearances
  const avgMissing: number[] = Array(10).fill(0);
  for (let n = 0; n < 10; n++) {
    const positions: number[] = [];
    slice.forEach((r, i) => {
      if (r.resultNumber === n) positions.push(i);
    });
    if (positions.length <= 1) {
      avgMissing[n] = positions.length === 0 ? slice.length : Math.floor(slice.length / 2);
    } else {
      let sum = 0;
      for (let i = 1; i < positions.length; i++) {
        sum += positions[i]! - positions[i - 1]!;
      }
      avgMissing[n] = Math.round(sum / (positions.length - 1));
    }
  }

  return { missing, avgMissing, frequency, maxConsecutive, count: slice.length };
}
