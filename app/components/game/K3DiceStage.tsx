"use client";

/**
 * K3 dice stage — production lifecycle:
 * - Roll window bound to countdown (last 5s)
 * - Land exactly once per resultKey
 * - periodId change resets roll gate for next round
 * - WebGL engine pauses when idle / tab hidden (never blocks countdown)
 */

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Dice3DEngine, DiceTriple } from "./dice3d/Dice3DEngine";

export const DICE_FACE: Record<number, string> = {
  1: "/assets/png/dice_1-3eb8e22b.png",
  2: "/assets/png/dice_2-38383685.png",
  3: "/assets/png/dice_3-c91e0c1c.png",
  4: "/assets/png/dice_4-3537b074.png",
  5: "/assets/png/dice_5-a11110ab.png",
  6: "/assets/png/dice_6-3734f323.png",
};

type Props = {
  dice1?: number | null;
  dice2?: number | null;
  dice3?: number | null;
  resultKey?: string | null;
  countdown: number;
  /** When period advances, allow a new roll cycle */
  periodId?: string | null;
  sum?: number | null;
  metaLine?: React.ReactNode;
  children?: React.ReactNode;
};

function clampFace(n: number | null | undefined): number {
  if (!n || n < 1 || n > 6) return 1;
  return n;
}

function facesOf(
  d1?: number | null,
  d2?: number | null,
  d3?: number | null
): DiceTriple {
  return [clampFace(d1), clampFace(d2), clampFace(d3)];
}

export default function K3DiceStage({
  dice1,
  dice2,
  dice3,
  resultKey,
  countdown,
  periodId,
  sum,
  metaLine,
  children,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Dice3DEngine | null>(null);

  const lastKey = useRef<string | null>(null);
  const landingKey = useRef<string | null>(null);
  const rollingRef = useRef(false);
  const rolledForPeriod = useRef<string | null>(null);
  const facesRef = useRef<DiceTriple>([1, 1, 1]);

  const [phase, setPhase] = useState<"idle" | "rolling" | "landed">("idle");
  const [ready, setReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  facesRef.current = facesOf(dice1, dice2, dice3);

  // Boot engine once
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let visHandler: (() => void) | null = null;

    (async () => {
      try {
        const { Dice3DEngine } = await import("./dice3d/Dice3DEngine");
        if (cancelled || !canvasRef.current) return;
        const engine = new Dice3DEngine(canvasRef.current);
        engine.setIdleFaces(facesRef.current);
        engineRef.current = engine;
        setReady(true);

        ro = new ResizeObserver(() => engine.resize());
        if (hostRef.current) ro.observe(hostRef.current);
        engine.resize();

        visHandler = () => {
          if (document.hidden) engine.setPaused(true);
          else engine.setPaused(false);
        };
        document.addEventListener("visibilitychange", visHandler);
      } catch (e) {
        console.warn("[K3DiceStage] WebGL dice failed, using fallback", e);
        setWebglFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (visHandler) document.removeEventListener("visibilitychange", visHandler);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // New period → allow a fresh roll cycle
  useEffect(() => {
    if (!periodId) return;
    if (rolledForPeriod.current && rolledForPeriod.current !== periodId) {
      // advanced
    }
    // If period changed and we're not mid-land, clear roll lock for next 5s window
    if (rolledForPeriod.current !== periodId && !landingKey.current) {
      // keep lastKey (result) so we don't re-animate old result
    }
  }, [periodId]);

  // Idle face sync
  useEffect(() => {
    if (!engineRef.current || !ready) return;
    if (rollingRef.current) return;
    if (dice1 && dice2 && dice3) {
      engineRef.current.setIdleFaces(facesOf(dice1, dice2, dice3));
    }
  }, [dice1, dice2, dice3, ready]);

  // Start roll in last 5 seconds — exactly once per live period
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    if (countdown <= 0 || countdown > 5) return;
    if (rollingRef.current) return;
    // Need a stable period identity; without it we risk re-toss every tick
    if (!periodId) return;
    if (rolledForPeriod.current === periodId) return;

    rolledForPeriod.current = periodId;
    rollingRef.current = true;
    landingKey.current = null;
    setPhase("rolling");
    engineRef.current.startRolling();
  }, [countdown, ready, periodId]);

  // Land exactly once when resultKey changes
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    if (!resultKey || !dice1 || !dice2 || !dice3) return;

    const faces = facesOf(dice1, dice2, dice3);

    if (resultKey === lastKey.current) {
      if (!rollingRef.current) engineRef.current.setIdleFaces(faces);
      return;
    }
    if (resultKey === landingKey.current) return;

    const animating =
      rollingRef.current ||
      engineRef.current.getPhase() === "rolling" ||
      engineRef.current.getPhase() === "settling";

    // Only animate land if we were rolling or just hit zero; otherwise quiet update
    if (animating || countdown <= 1) {
      rollingRef.current = true;
      landingKey.current = resultKey;
      setPhase("rolling");
      const key = resultKey;
      engineRef.current.landOn(faces, () => {
        if (landingKey.current !== key) return;
        rollingRef.current = false;
        lastKey.current = key;
        landingKey.current = null;
        setPhase("landed");
        window.setTimeout(() => {
          setPhase((p) => (p === "landed" ? "idle" : p));
        }, 500);
      });
    } else {
      engineRef.current.setIdleFaces(faces);
      lastKey.current = resultKey;
      landingKey.current = null;
      rollingRef.current = false;
      setPhase("idle");
    }
  }, [resultKey, dice1, dice2, dice3, countdown, ready]);

  // Hard safety: never stay rolling > 7s
  useEffect(() => {
    if (phase !== "rolling") return;
    const t = window.setTimeout(() => {
      if (!rollingRef.current || !engineRef.current) return;
      const faces = facesRef.current;
      const key = resultKey ?? landingKey.current ?? `force-${Date.now()}`;
      if (landingKey.current && landingKey.current !== key) return;
      landingKey.current = key;
      engineRef.current.landOn(faces, () => {
        rollingRef.current = false;
        if (resultKey) lastKey.current = resultKey;
        landingKey.current = null;
        setPhase("idle");
      });
    }, 7000);
    return () => window.clearTimeout(t);
  }, [phase, resultKey]);

  const rolling = phase === "rolling";

  return (
    <div
      className="k3-dice-stage relative mx-2 sm:mx-3 mt-3 overflow-hidden rounded-[14px] min-w-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 20%, #2f252c 0%, #1a1519 55%, #110d14 100%)",
        border: "1px solid rgba(254,211,88,0.16)",
        boxShadow: rolling
          ? "inset 0 0 48px rgba(254,211,88,0.1), 0 8px 28px rgba(0,0,0,0.4)"
          : "inset 0 0 24px rgba(0,0,0,0.4), 0 6px 20px rgba(0,0,0,0.35)",
      }}
    >
      <div
        ref={hostRef}
        className="relative w-full min-w-0"
        style={{ height: "clamp(10rem, 40vw, 15.5rem)" }}
      >
        {!webglFailed ? (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            aria-label="3D dice tray"
          />
        ) : (
          <FallbackDice faces={facesOf(dice1, dice2, dice3)} rolling={rolling} />
        )}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, transparent 40%, rgba(0,0,0,0.35) 100%)",
          }}
        />
      </div>

      {(sum != null || metaLine) && (
        <div className="relative -mt-1 px-3 pb-3 text-center">
          {sum != null && (
            <p className="text-[13px] text-white/55">
              Sum{" "}
              <span className="text-[15px] font-black text-[#FED358]">{sum}</span>
            </p>
          )}
          {metaLine}
        </div>
      )}

      {rolling && (
        <p className="absolute bottom-2 left-0 right-0 z-20 text-center text-[11px] font-bold uppercase tracking-widest text-[#FED358] animate-pulse">
          Rolling…
        </p>
      )}

      {children}
    </div>
  );
}

function FallbackDice({
  faces,
  rolling,
}: {
  faces: DiceTriple;
  rolling: boolean;
}) {
  return (
    <div className="flex h-full items-center justify-center gap-4 px-4">
      {faces.map((face, i) => (
        <div
          key={i}
          className={`relative ${rolling ? "k3-die--rolling" : ""}`}
          style={{
            width: "clamp(4rem, 20vw, 5.5rem)",
            height: "clamp(4rem, 20vw, 5.5rem)",
            filter: "drop-shadow(0 10px 14px rgba(0,0,0,0.55))",
          }}
        >
          <div className="k3-die-inner absolute inset-0">
            <Image
              src={DICE_FACE[face] ?? DICE_FACE[1]!}
              alt={`Dice ${face}`}
              fill
              sizes="90px"
              className="object-contain"
              priority={i === 0}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function K3MiniDice({
  d1,
  d2,
  d3,
  size = 18,
}: {
  d1: number;
  d2: number;
  d3: number;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center justify-center gap-0.5">
      {[d1, d2, d3].map((d, i) => (
        <span
          key={i}
          className="relative inline-block shrink-0 drop-shadow-sm"
          style={{ width: size, height: size }}
        >
          <Image
            src={DICE_FACE[d] ?? DICE_FACE[1]!}
            alt=""
            fill
            sizes={`${size}px`}
            className="object-contain"
          />
        </span>
      ))}
    </span>
  );
}
