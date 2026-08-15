"use client";

/**
 * Thin React shell — all motion lives in RaceEngine + sub-engines.
 * Same public handle as before (MotoPage unchanged).
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { PodiumResult, RaceCanvasHandle } from "../types";
import type { RaceEngine as RaceEngineType } from "./engine/RaceEngine";

export const RaceCanvas = forwardRef<
  RaceCanvasHandle,
  { className?: string }
>(function RaceCanvas({ className }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RaceEngineType | null>(null);
  const readyRef = useRef(false);
  const destroyedRef = useRef(false);
  const initRef = useRef<Promise<void> | null>(null);

  useImperativeHandle(ref, () => ({
    startRacing() {
      void ensureReady().then(() => engineRef.current?.startRacing());
    },
    async finishWithPodium(podium: PodiumResult) {
      await ensureReady();
      if (!engineRef.current) return false;
      return engineRef.current.finishWithPodium(podium);
    },
    async playRace(podium: PodiumResult) {
      await ensureReady();
      if (!engineRef.current) return false;
      return engineRef.current.playRace(podium);
    },
    setIdle() {
      engineRef.current?.setIdle();
    },
    isReady() {
      return readyRef.current && !!engineRef.current;
    },
    getPhase() {
      return engineRef.current?.getPhase() ?? "idle";
    },
  }));

  async function ensureReady() {
    if (readyRef.current && engineRef.current) return;
    if (initRef.current) await initRef.current;
    // wait a few frames if still mounting
    for (let i = 0; i < 40 && !engineRef.current; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  useEffect(() => {
    destroyedRef.current = false;
    const host = hostRef.current;
    if (!host) return;

    let ro: ResizeObserver | null = null;

    initRef.current = (async () => {
      const pixi = await import("pixi.js");
      if (destroyedRef.current || !hostRef.current) return;

      const el = hostRef.current;
      const w = Math.max(el.clientWidth || 320, 200);
      const h = Math.max(el.clientHeight || 200, 160);

      const app = new pixi.Application();
      await app.init({
        width: w,
        height: h,
        background: 0x0e0a12,
        antialias: true,
        resolution: Math.min(
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
          2
        ),
        autoDensity: true,
        powerPreference: "high-performance",
        preference: "webgl",
      });

      if (destroyedRef.current) {
        app.destroy(true);
        return;
      }

      el.innerHTML = "";
      el.appendChild(app.canvas);

      const { RaceEngine } = await import("./engine/RaceEngine");
      const engine = new RaceEngine(app, pixi);
      engineRef.current = engine;
      readyRef.current = true;

      ro = new ResizeObserver(() => {
        if (!hostRef.current || !engineRef.current) return;
        const nw = Math.max(hostRef.current.clientWidth, 200);
        const nh = Math.max(hostRef.current.clientHeight, 160);
        app.renderer.resize(nw, nh);
        engineRef.current.resize();
      });
      ro.observe(el);

      (app as unknown as { __dispose?: () => void }).__dispose = () => {
        ro?.disconnect();
        engine.destroy();
        try {
          app.destroy(true);
        } catch {
          /* */
        }
      };
    })().catch((e) => {
      console.error("[RaceCanvas] init failed", e);
    });

    return () => {
      destroyedRef.current = true;
      readyRef.current = false;
      ro?.disconnect();
      engineRef.current?.destroy();
      engineRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "none",
        background:
          "radial-gradient(ellipse at 50% 20%, #1a1028 0%, #0e0a12 65%)",
      }}
    />
  );
});
