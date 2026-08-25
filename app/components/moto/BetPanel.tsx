"use client";

/**
 * BetPanel — Moto Racing betting UI
 *
 * Backend contract (POST /moto/bet):
 *   betType: POSITION | ODD_EVEN | BIG_SMALL
 *   betChoice: "1"–"10" | "odd"|"even" | "big"|"small"
 *   targetPosition: FIRST | SECOND | THIRD
 *
 * Odds (from engine gameLogic): POSITION 9.8x, ODD_EVEN/BIG_SMALL 2x
 */

import React from "react";
import { bikeColor, BIKE_NUMBERS, type TargetPos } from "./constants";
import "./moto-feel.css";

export type MotoBetOpen = {
  betType: "POSITION" | "ODD_EVEN" | "BIG_SMALL";
  betChoice: string;
  targetPosition: TargetPos;
  label: string;
};

interface BetPanelProps {
  target: TargetPos;
  onTarget: (t: TargetPos) => void;
  locked: boolean;
  onBet: (bet: MotoBetOpen) => void;
}

const TARGET_TABS: { id: TargetPos; label: string; short: string }[] = [
  { id: "FIRST", label: "1st Number", short: "1st" },
  { id: "SECOND", label: "2nd Number", short: "2nd" },
  { id: "THIRD", label: "3rd Number", short: "3rd" },
];

const ODDS_POSITION = "9.8X";
const ODDS_OE_BS = "2X";

function posShort(pos: TargetPos): string {
  return pos === "FIRST" ? "1st" : pos === "SECOND" ? "2nd" : "3rd";
}

export function BetPanel({ target, onTarget, locked, onBet }: BetPanelProps) {
  const targetLabel = TARGET_TABS.find((t) => t.id === target)?.short ?? "1st";

  return (
    <div
      className="moto-feel mx-3 mt-3 rounded-[14px] overflow-hidden"
      style={{
        background: "#1a1519",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="relative overflow-hidden px-4 py-3"
        style={{
          background:
            "linear-gradient(135deg, #2a2228 0%, #1a1519 60%, #241E22 100%)",
        }}
      >
        <div
          className="absolute right-0 bottom-0 w-[160px] h-[60px] opacity-20 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 100% 100%, #FED358 0%, transparent 70%)",
          }}
        />
        <div className="flex items-center justify-between relative z-[1]">
          <h3
            className="text-[18px] font-black text-white"
            style={{ letterSpacing: "0.02em" }}
          >
            Betting Area
          </h3>
          <svg
            width="48"
            height="36"
            viewBox="0 0 64 48"
            fill="none"
            className="opacity-50"
            aria-hidden
          >
            <ellipse cx="16" cy="36" rx="10" ry="10" fill="#FED358" opacity="0.3" />
            <ellipse cx="48" cy="36" rx="10" ry="10" fill="#FED358" opacity="0.3" />
            <path
              d="M18 36 L28 20 L42 18 L50 24 L48 36"
              stroke="#FED358"
              strokeWidth="2"
              fill="none"
              opacity="0.6"
            />
            <circle cx="16" cy="36" r="5" stroke="#FED358" strokeWidth="1.5" fill="none" />
            <circle cx="48" cy="36" r="5" stroke="#FED358" strokeWidth="1.5" fill="none" />
            <path
              d="M28 20 L32 14 L38 14 L42 18"
              stroke="#FED358"
              strokeWidth="1.5"
              fill="none"
              opacity="0.8"
            />
            <circle cx="35" cy="12" r="3" fill="#FED358" opacity="0.4" />
          </svg>
        </div>
      </div>

      {/* Target position tabs — used for POSITION bets */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        {TARGET_TABS.map((tab) => {
          const active = target === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTarget(tab.id)}
              className="text-[15px] font-bold pb-1 transition-colors"
              style={{
                color: active ? "#FED358" : "rgba(255,255,255,0.4)",
                borderBottom: active
                  ? "2px solid #FED358"
                  : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="px-4 text-[13px] text-white/30 mb-2">
        Select {targetLabel} number{" "}
        <span className="text-[#FED358]/70">(Odds {ODDS_POSITION})</span>
      </p>

      {/* Bike numbers 1–10 → POSITION + active target tab */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-5 gap-2.5">
          {BIKE_NUMBERS.map((n) => {
            const c = bikeColor(n);
            return (
              <button
                key={n}
                type="button"
                disabled={locked}
                onClick={() =>
                  onBet({
                    betType: "POSITION",
                    betChoice: String(n),
                    targetPosition: target,
                    label: `${targetLabel} #${n}`,
                  })
                }
                className="moto-ball relative flex items-center justify-center rounded-full aspect-square disabled:opacity-40"
                style={{
                  background: `linear-gradient(150deg, ${c.glow}, ${c.primary})`,
                  boxShadow: `0 3px 12px ${c.primary}55, inset 0 -3px 6px rgba(0,0,0,0.25), inset 0 2px 4px rgba(255,255,255,0.3)`,
                }}
              >
                <span
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: "16%",
                    top: "10%",
                    width: "40%",
                    height: "30%",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)",
                  }}
                  aria-hidden
                />
                <span
                  className="relative z-[1] font-black text-white tabular-nums leading-none"
                  style={{
                    fontSize: n >= 10 ? 14 : 16,
                    textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                  }}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px mx-4" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* Odd / Even — per podium place (backend: choice odd|even + targetPosition) */}
      <div className="px-4 pt-3 pb-1">
        <h4 className="text-[16px] font-bold text-[#FED358] mb-0.5">Odd or Even</h4>
        <p className="text-[13px] text-white/30 mb-2.5">
          Select the rank number as odd or even
        </p>

        {(["FIRST", "SECOND", "THIRD"] as TargetPos[]).map((pos) => {
          const pl = posShort(pos);
          return (
            <div key={pos} className="flex items-center gap-2 mb-2">
              <span className="text-[14px] font-bold text-white/60 w-8 shrink-0">
                {pl}
              </span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    onBet({
                      betType: "ODD_EVEN",
                      betChoice: "odd",
                      targetPosition: pos,
                      label: `${pl} Odd`,
                    })
                  }
                  className="h-[44px] rounded-[10px] flex flex-col items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-40"
                  style={{
                    background: "rgba(23,177,94,0.12)",
                    border: "1px solid rgba(23,177,94,0.35)",
                  }}
                >
                  <span className="text-[15px] font-bold text-white/90">Odd</span>
                  <span className="text-[12px] text-white/35">{ODDS_OE_BS}</span>
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    onBet({
                      betType: "ODD_EVEN",
                      betChoice: "even",
                      targetPosition: pos,
                      label: `${pl} Even`,
                    })
                  }
                  className="h-[44px] rounded-[10px] flex flex-col items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-40"
                  style={{
                    background: "rgba(80,136,211,0.12)",
                    border: "1px solid rgba(80,136,211,0.35)",
                  }}
                >
                  <span className="text-[15px] font-bold text-white/90">Even</span>
                  <span className="text-[12px] text-white/35">{ODDS_OE_BS}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="h-px mx-4" style={{ background: "rgba(255,255,255,0.06)" }} />

      {/* Big / Small — backend: big = 6–10, small = 1–5 */}
      <div className="px-4 pt-3 pb-4">
        <h4 className="text-[16px] font-bold text-[#FED358] mb-0.5">Big or Small</h4>
        <p className="text-[13px] text-white/30 mb-2.5">
          Big (6&amp;over) or Small (under 6)
        </p>

        {(["FIRST", "SECOND", "THIRD"] as TargetPos[]).map((pos) => {
          const pl = posShort(pos);
          return (
            <div key={pos} className="flex items-center gap-2 mb-2">
              <span className="text-[14px] font-bold text-white/60 w-8 shrink-0">
                {pl}
              </span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    onBet({
                      betType: "BIG_SMALL",
                      betChoice: "big",
                      targetPosition: pos,
                      label: `${pl} Big`,
                    })
                  }
                  className="h-[44px] rounded-[10px] flex flex-col items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-40"
                  style={{
                    background: "rgba(221,145,56,0.12)",
                    border: "1px solid rgba(221,145,56,0.35)",
                  }}
                >
                  <span className="text-[15px] font-bold text-white/90">Big</span>
                  <span className="text-[12px] text-white/35">{ODDS_OE_BS}</span>
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    onBet({
                      betType: "BIG_SMALL",
                      betChoice: "small",
                      targetPosition: pos,
                      label: `${pl} Small`,
                    })
                  }
                  className="h-[44px] rounded-[10px] flex flex-col items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-40"
                  style={{
                    background: "rgba(155,72,219,0.12)",
                    border: "1px solid rgba(155,72,219,0.35)",
                  }}
                >
                  <span className="text-[15px] font-bold text-white/90">Small</span>
                  <span className="text-[12px] text-white/35">{ODDS_OE_BS}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
