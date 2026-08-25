"use client";

/**
 * 5D odometer stage — mechanical rolling digits (car/bike trip meter style).
 * Reels spin fast near period end, then decelerate and lock on backend result.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

export type FiveDigits = [number, number, number, number, number];

type Props = {
  digitA?: number | null;
  digitB?: number | null;
  digitC?: number | null;
  digitD?: number | null;
  digitE?: number | null;
  sum?: number | null;
  resultKey?: string | null;
  countdown: number;
  periodId?: string | null;
  children?: React.ReactNode;
};

const LABELS = ["A", "B", "C", "D", "E"] as const;
/** Visible window height of one digit cell (px) — scales via CSS var on stage */
const CELL = 52;
/** How many 0–9 bands we paint on the strip */
const BANDS = 12;

function clampDigit(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.min(9, Math.max(0, Math.floor(n)));
}

function digitsOf(
  a?: number | null,
  b?: number | null,
  c?: number | null,
  d?: number | null,
  e?: number | null
): FiveDigits {
  return [
    clampDigit(a),
    clampDigit(b),
    clampDigit(c),
    clampDigit(d),
    clampDigit(e),
  ];
}

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

/** Seamless vertical digit strip: position is fractional digit units (0 = top of “0”) */
function OdometerReel({ value }: { value: number }) {
  // Keep translate within middle bands so we never hit strip ends
  const mid = Math.floor(BANDS / 2) * 10;
  const normalized = ((value % 10) + 10) % 10;
  const y = -(mid + normalized) * CELL;

  const nums: number[] = [];
  for (let b = 0; b < BANDS; b++) {
    for (let d = 0; d < 10; d++) nums.push(d);
  }

  return (
    <div
      className="fived-odo-window relative overflow-hidden select-none shrink min-w-0"
      style={{
        width: "clamp(1.85rem, 11vw, 3rem)",
        height: CELL,
        background:
          "linear-gradient(180deg, #1a1612 0%, #0c0a08 45%, #14100c 100%)",
        boxShadow:
          "inset 0 2px 4px rgba(0,0,0,0.75), inset 0 -1px 0 rgba(255,255,255,0.04)",
        borderRadius: 4,
      }}
    >
      {/* Top/bottom shade like real odometer glass */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[35%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[35%]"
        style={{
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 100%)",
        }}
      />
      {/* Center reading line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px -translate-y-1/2"
        style={{ background: "rgba(254,211,88,0.12)" }}
      />

      <div
        className="fived-odo-strip absolute left-0 right-0 will-change-transform"
        style={{
          transform: `translate3d(0, ${y}px, 0)`,
        }}
      >
        {nums.map((d, i) => (
          <div
            key={i}
            className="flex items-center justify-center font-black tabular-nums"
            style={{
              height: CELL,
              fontSize: "clamp(1.15rem, 5.5vw, 1.85rem)",
              lineHeight: 1,
              color: "#e8dcc4",
              textShadow: "0 1px 0 rgba(0,0,0,0.8)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.02em",
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FiveDStage({
  digitA,
  digitB,
  digitC,
  digitD,
  digitE,
  sum,
  resultKey,
  countdown,
  periodId,
  children,
}: Props) {
  const lastKey = useRef<string | null>(null);
  const spinningRef = useRef(false);
  const spunForPeriod = useRef<string | null>(null);
  const rafRef = useRef(0);
  const posRef = useRef<number[]>([0, 0, 0, 0, 0]);
  const velRef = useRef<number[]>([0, 0, 0, 0, 0]);
  const modeRef = useRef<"idle" | "spin" | "decel">("idle");
  const landTargets = useRef<FiveDigits | null>(null);
  const landStart = useRef<number[]>([0, 0, 0, 0, 0]);
  const landEnd = useRef<number[]>([0, 0, 0, 0, 0]);
  const landT0 = useRef(0);
  const landDur = useRef([1.1, 1.35, 1.6, 1.85, 2.1]); // stagger stop A→E
  const lastTs = useRef(0);
  const [, bump] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landed">("idle");

  const paint = useCallback(() => bump((n) => (n + 1) % 1_000_000), []);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    lastTs.current = 0;
  }, []);

  const loop = useCallback(() => {
    const now = performance.now();
    const dt = lastTs.current
      ? Math.min(0.05, (now - lastTs.current) / 1000)
      : 1 / 60;
    lastTs.current = now;
    const mode = modeRef.current;

    if (mode === "spin") {
      // Fast free spin — E (right) slightly faster, like a trip meter
      for (let i = 0; i < 5; i++) {
        const base = 22 + i * 3.5; // digits / second
        velRef.current[i] = base;
        posRef.current[i]! += velRef.current[i]! * dt;
      }
      paint();
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (mode === "decel") {
      const targets = landTargets.current;
      if (!targets) {
        modeRef.current = "idle";
        spinningRef.current = false;
        setPhase("idle");
        return;
      }

      let allDone = true;
      for (let i = 0; i < 5; i++) {
        const dur = landDur.current[i]! * 1000;
        const t = Math.min(1, (now - landT0.current) / dur);
        const e = easeOutQuint(t);
        const start = landStart.current[i]!;
        const end = landEnd.current[i]!;
        posRef.current[i] = start + (end - start) * e;
        if (t < 1) allDone = false;
      }
      paint();

      if (allDone) {
        for (let i = 0; i < 5; i++) {
          posRef.current[i] = landEnd.current[i]!;
        }
        modeRef.current = "idle";
        spinningRef.current = false;
        setPhase("landed");
        paint();
        window.setTimeout(() => setPhase("idle"), 500);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [paint]);

  const startSpin = useCallback(() => {
    stopLoop();
    spinningRef.current = true;
    modeRef.current = "spin";
    setPhase("spinning");
    // seed velocities / keep current positions continuous
    for (let i = 0; i < 5; i++) {
      velRef.current[i] = 18 + i * 2;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, stopLoop]);

  const landOn = useCallback(
    (final: FiveDigits) => {
      stopLoop();
      spinningRef.current = true;
      modeRef.current = "decel";
      setPhase("spinning");
      landTargets.current = final;
      landT0.current = performance.now();

      for (let i = 0; i < 5; i++) {
        const cur = posRef.current[i]!;
        const curDigit = ((cur % 10) + 10) % 10;
        const target = final[i]!;
        // Extra full revolutions while decelerating (more for later reels)
        const extraTurns = 4 + i * 2; // 4,6,8,10,12
        let delta = target - curDigit;
        if (delta <= 0) delta += 10;
        // Always roll forward at least extraTurns full cycles + remainder
        landStart.current[i] = cur;
        landEnd.current[i] = cur + delta + extraTurns * 10;
        landDur.current[i] = 1.05 + i * 0.28; // A stops first, E last
      }

      rafRef.current = requestAnimationFrame(loop);
    },
    [loop, stopLoop]
  );

  // Idle sync when not spinning
  useEffect(() => {
    if (spinningRef.current || modeRef.current !== "idle") return;
    const d = digitsOf(digitA, digitB, digitC, digitD, digitE);
    for (let i = 0; i < 5; i++) {
      // Keep integer floor aligned to digit
      const base = Math.floor(posRef.current[i]! / 10) * 10;
      posRef.current[i] = base + d[i]!;
    }
    paint();
  }, [digitA, digitB, digitC, digitD, digitE, paint]);

  // Start free-spin in last 5s once per period
  useEffect(() => {
    if (countdown <= 0 || countdown > 5) return;
    if (spinningRef.current) return;
    if (!periodId) return;
    if (spunForPeriod.current === periodId) return;
    spunForPeriod.current = periodId;
    startSpin();
  }, [countdown, periodId, startSpin]);

  // Land on backend result
  useEffect(() => {
    if (!resultKey) return;
    const final = digitsOf(digitA, digitB, digitC, digitD, digitE);

    if (resultKey === lastKey.current) {
      if (!spinningRef.current && modeRef.current === "idle") {
        for (let i = 0; i < 5; i++) {
          const base = Math.floor(posRef.current[i]! / 10) * 10;
          posRef.current[i] = base + final[i]!;
        }
        paint();
      }
      return;
    }

    const shouldAnimate =
      spinningRef.current ||
      modeRef.current === "spin" ||
      countdown <= 1;

    lastKey.current = resultKey;

    if (!shouldAnimate) {
      for (let i = 0; i < 5; i++) {
        posRef.current[i] = final[i]!;
      }
      modeRef.current = "idle";
      spinningRef.current = false;
      setPhase("idle");
      paint();
      return;
    }

    // If not already spinning, kick a short spin then land
    if (modeRef.current === "idle") {
      startSpin();
      window.setTimeout(() => landOn(final), 350);
    } else {
      landOn(final);
    }
  }, [
    resultKey,
    digitA,
    digitB,
    digitC,
    digitD,
    digitE,
    countdown,
    landOn,
    startSpin,
    paint,
  ]);

  // Safety: never spin forever
  useEffect(() => {
    if (phase !== "spinning") return;
    const t = window.setTimeout(() => {
      if (!spinningRef.current) return;
      const final = digitsOf(digitA, digitB, digitC, digitD, digitE);
      landOn(final);
    }, 9000);
    return () => window.clearTimeout(t);
  }, [phase, digitA, digitB, digitC, digitD, digitE, landOn]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const spinning = phase === "spinning";
  const shown = posRef.current.map((p) => {
    const d = Math.round(((p % 10) + 10) % 10);
    return d === 10 ? 0 : d;
  });
  const sumDisplay =
    sum != null
      ? sum
      : !spinning
        ? shown.reduce((a, b) => a + b, 0)
        : null;

  return (
    <div
      className="fived-stage relative mx-2 sm:mx-3 mt-3 overflow-hidden rounded-[14px] px-2 sm:px-3 py-4 sm:py-5 min-w-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 20%, #2a221c 0%, #161210 55%, #0e0c0a 100%)",
        border: "1px solid rgba(254,211,88,0.16)",
        boxShadow: spinning
          ? "inset 0 0 36px rgba(254,211,88,0.08)"
          : "inset 0 0 20px rgba(0,0,0,0.45)",
      }}
    >
      {/* Housing bezel */}
      <div
        className="relative mx-auto w-full max-w-[min(100%,340px)] rounded-[10px] px-1.5 sm:px-2.5 py-2.5 sm:py-3"
        style={{
          background:
            "linear-gradient(180deg, #3a3228 0%, #241e18 40%, #1a1510 100%)",
          boxShadow:
            "0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          border: "1px solid rgba(200,170,100,0.22)",
        }}
      >
        <div
          className="flex items-center justify-center gap-px sm:gap-[3px] rounded-[6px] px-1 sm:px-1.5 py-1.5 min-w-0"
          style={{
            background: "#0a0908",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
          }}
        >
          {posRef.current.map((val, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <div
                  className="w-px self-stretch my-1 opacity-30"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <OdometerReel value={val} />
                <span
                  className="text-[12px] font-black tracking-widest"
                  style={{ color: "rgba(232,220,196,0.45)" }}
                >
                  {LABELS[i]}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Tiny odometer brand plate */}
        <p
          className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.28em]"
          style={{ color: "rgba(254,211,88,0.35)" }}
        >
          5D · Totalizer
        </p>
      </div>

      {sumDisplay != null && !spinning && (
        <p className="relative mt-3 text-center text-[15px] text-white/55">
          Sum{" "}
          <span className="text-[18px] font-black text-[#FED358] tabular-nums">
            {sumDisplay}
          </span>
          {sumDisplay >= 23 ? (
            <span className="ml-2 text-[13px] font-bold text-[#DD9138]">
              High
            </span>
          ) : (
            <span className="ml-2 text-[13px] font-bold text-[#5088D3]">
              Low
            </span>
          )}
          <span className="ml-1.5 text-[13px] font-bold text-white/40">
            · {sumDisplay % 2 === 0 ? "Even" : "Odd"}
          </span>
        </p>
      )}

      {spinning && (
        <p className="relative mt-3 text-center text-[13px] font-bold uppercase tracking-widest text-[#FED358]/animate-pulse">
          Rolling…
        </p>
      )}

      {children}
    </div>
  );
}

/** Compact five digits for history — monochrome odometer style */
export function FiveDMiniDigits({
  a,
  b,
  c,
  d,
  e,
}: {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-px rounded px-1 py-0.5 font-black tabular-nums tracking-wider"
      style={{
        background: "#0c0a08",
        color: "#e8dcc4",
        fontSize: 14,
        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
      }}
    >
      {[a, b, c, d, e].map((n, i) => (
        <span key={i} className="px-0.5">
          {n}
        </span>
      ))}
    </span>
  );
}
