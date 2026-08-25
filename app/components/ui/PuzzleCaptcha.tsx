"use client";

import { asset } from "../../lib/cdn";
/**
 * Slide-to-match puzzle captcha (Bcwin-style).
 * Loads a fresh nature photo from /api/captcha/nature on each regenerate.
 */

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IoCheckmarkCircle,
  IoCloseCircle,
  IoRefresh,
  IoChevronForward,
} from "react-icons/io5";

const PIECE = 52;
const STAGE_H = 168;
const TOLERANCE = 12;
const TIMEOUT_MS = 90_000;
const HANDLE_W = 44;
const TOKEN_TTL_MS = 5 * 60 * 1000;

const LOCAL_FALLBACKS = [
  asset("/assets/captcha/sunset_1.jpg"),
  asset("/assets/captcha/sunset_2.jpg"),
  asset("/assets/captcha/sunset_3.jpg"),
] as const;

const FALLBACK_GRADIENT =
  "linear-gradient(165deg,#1a2744 0%,#c45c2a 42%,#e8a84a 62%,#2a1030 100%)";

export type PuzzleCaptchaResult = {
  token: string;
  verifiedAt: number;
};

type Props = {
  onVerified: (result: PuzzleCaptchaResult) => void;
  onReset?: () => void;
  className?: string;
  /** Bump to force a fresh puzzle (e.g. after failed login) */
  resetKey?: number | string;
  /**
   * Already-fetched + preloaded image URL (from login-page warm-up).
   * When set, first paint skips the loading spinner.
   */
  preloadedScene?: string | null;
  /**
   * Resolve the next scene (prefer parent standby cache).
   * Used on Refresh / fail regenerate.
   */
  resolveScene?: () => Promise<string>;
};

export function parseCaptchaToken(
  token: string
): { t: number; o: number; n: string } | null {
  try {
    const raw = atob(token);
    const p = JSON.parse(raw) as { t?: number; o?: number; n?: string };
    if (typeof p.t !== "number") return null;
    return { t: p.t, o: p.o ?? 0, n: p.n ?? "" };
  } catch {
    return null;
  }
}

export function isCaptchaTokenFresh(
  token: string,
  ttlMs = TOKEN_TTL_MS
): boolean {
  const p = parseCaptchaToken(token);
  if (!p) return false;
  return Date.now() - p.t <= ttlMs;
}

function makeToken(offset: number): string {
  const payload = JSON.stringify({
    o: Math.round(offset),
    t: Date.now(),
    n: Math.random().toString(36).slice(2, 10),
  });
  try {
    return btoa(payload);
  } catch {
    return payload;
  }
}

function jigsawPath(size: number): string {
  const s = size;
  const r = s * 0.18;
  return [
    `M 0 0`,
    `L ${s * 0.34} 0`,
    `C ${s * 0.34} ${-r} ${s * 0.66} ${-r} ${s * 0.66} 0`,
    `L ${s} 0`,
    `L ${s} ${s * 0.34}`,
    `C ${s + r} ${s * 0.34} ${s + r} ${s * 0.66} ${s} ${s * 0.66}`,
    `L ${s} ${s}`,
    `L ${s * 0.66} ${s}`,
    `C ${s * 0.66} ${s + r} ${s * 0.34} ${s + r} ${s * 0.34} ${s}`,
    `L 0 ${s}`,
    `L 0 ${s * 0.66}`,
    `C ${-r} ${s * 0.66} ${-r} ${s * 0.34} 0 ${s * 0.34}`,
    `Z`,
  ].join(" ");
}

function preloadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.referrerPolicy = "no-referrer";
    img.src = src;
  });
}

/** Fetch a nature photo URL and fully decode it into the browser cache. */
export async function preloadNatureScene(): Promise<string> {
  try {
    const res = await fetch(`/api/captcha/nature?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        const ok = await preloadImage(data.url);
        if (ok) return data.url;
        // URL may still work for <img> even if preload had a blip
        return data.url;
      }
    }
  } catch {
    // fall through
  }
  const local =
    LOCAL_FALLBACKS[Math.floor(Math.random() * LOCAL_FALLBACKS.length)]!;
  await preloadImage(local);
  return local;
}

async function fetchNatureScene(
  resolveScene?: () => Promise<string>
): Promise<string> {
  if (resolveScene) {
    try {
      const url = await resolveScene();
      if (url) return url;
    } catch {
      // fall through
    }
  }
  return preloadNatureScene();
}

export default function PuzzleCaptcha({
  onVerified,
  onReset,
  className = "",
  resetKey,
  preloadedScene = null,
  resolveScene,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const clipId = `pc-clip-${uid}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startClientX = useRef(0);
  const startOffset = useRef(0);
  const offsetRef = useRef(0);
  const fetchIdRef = useRef(0);
  /** Skip network on first paint when parent already warmed a scene */
  const usedPreloadRef = useRef(false);

  const onVerifiedRef = useRef(onVerified);
  const onResetRef = useRef(onReset);
  const resolveSceneRef = useRef(resolveScene);
  onVerifiedRef.current = onVerified;
  onResetRef.current = onReset;
  resolveSceneRef.current = resolveScene;

  const [stageW, setStageW] = useState(300);
  const [targetX, setTargetX] = useState(140);
  const [offset, setOffset] = useState(0);
  const [scene, setScene] = useState<string>(
    () => preloadedScene || LOCAL_FALLBACKS[0]!
  );
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [imgOk, setImgOk] = useState(true);
  const [loadingScene, setLoadingScene] = useState(!preloadedScene);
  const [gen, setGen] = useState(0);

  const maxOffset = Math.max(0, stageW - PIECE - 14);
  const path = useMemo(() => jigsawPath(PIECE), []);
  const pieceTop = Math.round((STAGE_H - PIECE) / 2);

  const setOffsetSafe = useCallback(
    (v: number) => {
      const clamped = Math.min(maxOffset, Math.max(0, v));
      offsetRef.current = clamped;
      setOffset(clamped);
      return clamped;
    },
    [maxOffset]
  );

  const applyLayout = useCallback(() => {
    const w = stageRef.current?.clientWidth || 300;
    setStageW(w);
    const minTx = Math.max(PIECE + 24, 56);
    const maxTx = Math.max(minTx + 16, w - PIECE - 16);
    const tx = minTx + Math.random() * Math.max(8, maxTx - minTx);
    setTargetX(tx);
    offsetRef.current = 0;
    setOffset(0);
    setStatus("idle");
    setMessage(null);
    setImgOk(true);
    setGen((g) => g + 1);
    onResetRef.current?.();
  }, []);

  const regenerate = useCallback(
    (opts?: { sceneUrl?: string | null; forceFetch?: boolean }) => {
      applyLayout();

      const instant = opts?.sceneUrl;
      if (instant && !opts?.forceFetch) {
        setScene(instant);
        setLoadingScene(false);
        setImgOk(true);
        return;
      }

      setLoadingScene(true);
      const id = ++fetchIdRef.current;
      void (async () => {
        const url = await fetchNatureScene(resolveSceneRef.current);
        if (id !== fetchIdRef.current) return;
        setScene(url);
        setImgOk(true);
        setLoadingScene(false);
      })();
    },
    [applyLayout]
  );

  // resetKey / mount: serve preloaded photo instantly when available
  useEffect(() => {
    if (preloadedScene) {
      usedPreloadRef.current = true;
      regenerate({ sceneUrl: preloadedScene });
    } else {
      regenerate({ forceFetch: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey drives re-roll
  }, [resetKey]);

  // Late warm-up: parent finished preload while spinner was showing
  useEffect(() => {
    if (!preloadedScene || !loadingScene) return;
    usedPreloadRef.current = true;
    fetchIdRef.current += 1; // cancel in-flight fetch
    setScene(preloadedScene);
    setLoadingScene(false);
    setImgOk(true);
  }, [preloadedScene, loadingScene]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStageW(el.clientWidth || 300);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (status === "ok" || loadingScene) return;
    const t = window.setTimeout(() => {
      setStatus("fail");
      setMessage("Verification timed out. Try again.");
      window.setTimeout(() => regenerate({ forceFetch: true }), 900);
    }, TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [status, gen, regenerate, loadingScene]);

  const finishDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (status === "ok" || loadingScene) return;
    const x = offsetRef.current;
    if (Math.abs(x - targetX) <= TOLERANCE) {
      setOffsetSafe(targetX);
      setStatus("ok");
      setMessage("Verification successful");
      onVerifiedRef.current({
        token: makeToken(targetX),
        verifiedAt: Date.now(),
      });
    } else {
      setStatus("fail");
      setMessage("Incorrect. Please try again.");
      window.setTimeout(() => regenerate({ forceFetch: true }), 750);
    }
  }, [targetX, regenerate, setOffsetSafe, status, loadingScene]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || status === "ok") return;
      const dx = e.clientX - startClientX.current;
      setOffsetSafe(startOffset.current + dx);
    };
    const onUp = () => finishDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [finishDrag, setOffsetSafe, status]);

  const beginDrag = (clientX: number) => {
    if (status === "ok" || loadingScene) return;
    dragging.current = true;
    startClientX.current = clientX;
    startOffset.current = offsetRef.current;
    setStatus("idle");
    setMessage(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (status === "ok" || loadingScene) return;
    const step = e.shiftKey ? 14 : 5;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setOffsetSafe(offsetRef.current + step);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setOffsetSafe(offsetRef.current - step);
    } else if (e.key === "Home") {
      e.preventDefault();
      setOffsetSafe(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setOffsetSafe(maxOffset);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dragging.current = true;
      finishDrag();
    }
  };

  const trackMax = Math.max(0, stageW - HANDLE_W - 8);
  const handleLeft = maxOffset > 0 ? (offset / maxOffset) * trackMax : 0;
  const fillPct = maxOffset > 0 ? (offset / maxOffset) * 100 : 0;
  const bgSize = `${Math.max(stageW, 1)}px ${STAGE_H}px`;
  const pieceBgPos = `-${targetX}px -${pieceTop}px`;

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#B79C8B]">
          Security verification
        </p>
        <button
          type="button"
          onClick={() => regenerate({ forceFetch: true })}
          disabled={loadingScene}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-bold text-[#FED358] active:opacity-80 disabled:opacity-50"
          style={{
            background: "rgba(254,211,88,0.1)",
            border: "1px solid rgba(254,211,88,0.25)",
          }}
          aria-label="Refresh puzzle captcha"
        >
          <IoRefresh
            size={14}
            className={loadingScene ? "animate-spin" : undefined}
          />
          Refresh
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-[12px] select-none"
        style={{
          height: STAGE_H,
          border: "1px solid #3D363A",
          background: FALLBACK_GRADIENT,
        }}
        role="group"
        aria-label="Slide the puzzle piece into the matching slot"
      >
        {/* Hidden SVG clip def for CSS clip-path (works with remote images) */}
        <svg width={0} height={0} className="absolute" aria-hidden>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={path} />
            </clipPath>
          </defs>
        </svg>

        {imgOk && !loadingScene ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={scene + gen}
            src={scene}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ objectFit: "fill" }}
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
          />
        ) : null}

        {loadingScene && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/40">
            <div
              className="h-7 w-7 animate-spin rounded-full border-2 border-[#FED358] border-t-transparent"
              aria-hidden
            />
            <p className="text-[13px] font-medium text-[#FDE4BC]">
              Loading nature scene…
            </p>
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.45) 100%)",
          }}
        />

        {/* Target slot */}
        <div
          className="pointer-events-none absolute z-[2]"
          style={{ left: targetX, top: pieceTop, width: PIECE, height: PIECE }}
          aria-hidden
        >
          <svg
            width={PIECE}
            height={PIECE}
            className="overflow-visible"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))" }}
          >
            <path
              d={path}
              fill="rgba(0,0,0,0.55)"
              stroke="rgba(254,211,88,0.7)"
              strokeWidth="1.75"
            />
          </svg>
        </div>

        {/* Draggable piece — CSS background so remote photos crop correctly */}
        <div
          className="absolute z-10 touch-none"
          style={{
            left: offset,
            top: pieceTop,
            width: PIECE,
            height: PIECE,
            cursor:
              status === "ok" || loadingScene ? "default" : "grab",
            filter:
              status === "ok"
                ? "drop-shadow(0 0 12px rgba(23,177,94,0.9))"
                : "drop-shadow(0 6px 14px rgba(0,0,0,0.6))",
            opacity: loadingScene ? 0.35 : 1,
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            beginDrag(e.clientX);
          }}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={Math.round(maxOffset)}
          aria-valuenow={Math.round(offset)}
          aria-label="Puzzle piece. Drag or use arrow keys, then press Enter to confirm"
          aria-disabled={loadingScene || status === "ok"}
          onKeyDown={onKeyDown}
        >
          <div
            className="absolute inset-0"
            style={{
              clipPath: `url(#${clipId})`,
              WebkitClipPath: `url(#${clipId})`,
              backgroundImage: imgOk && !loadingScene ? `url(${scene})` : FALLBACK_GRADIENT,
              backgroundSize: bgSize,
              backgroundPosition: pieceBgPos,
              backgroundRepeat: "no-repeat",
            }}
          />
          <svg
            width={PIECE}
            height={PIECE}
            className="pointer-events-none absolute inset-0 overflow-visible"
          >
            <path
              d={path}
              fill="none"
              stroke={
                status === "ok"
                  ? "#17B15E"
                  : status === "fail"
                    ? "#DA3735"
                    : "rgba(255,255,255,0.95)"
              }
              strokeWidth="2.25"
            />
          </svg>
        </div>

        {status === "ok" && (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[12px] font-bold text-[#17B15E]">
            <IoCheckmarkCircle size={14} /> Matched
          </div>
        )}
      </div>

      {/* Slider */}
      <div
        className="relative mt-2.5 h-11 w-full overflow-hidden rounded-[10px]"
        style={{
          background: "#241E22",
          border: `1px solid ${
            status === "ok"
              ? "rgba(23,177,94,0.55)"
              : status === "fail"
                ? "rgba(218,55,53,0.5)"
                : "#3D363A"
          }`,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-[10px] transition-[width] duration-75"
          style={{
            width: `${fillPct}%`,
            background:
              status === "ok"
                ? "linear-gradient(90deg,rgba(23,177,94,0.2),rgba(23,177,94,0.38))"
                : "linear-gradient(90deg,rgba(254,211,88,0.1),rgba(254,211,88,0.22))",
          }}
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-12 text-center text-[13px] font-medium text-[#837064] sm:text-[14px]">
          {loadingScene
            ? "Loading scene…"
            : status === "ok"
              ? "Verified"
              : "Slide to complete the puzzle"}
        </p>
        <button
          type="button"
          disabled={status === "ok" || loadingScene}
          className="absolute top-1/2 z-10 flex h-9 w-11 -translate-y-1/2 items-center justify-center rounded-[8px] active:scale-95 disabled:cursor-default"
          style={{
            left: 4 + handleLeft,
            background:
              status === "ok"
                ? "linear-gradient(180deg,#40AD72,#17B15E)"
                : "linear-gradient(180deg,#FED358,#E8A84A)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            beginDrag(e.clientX);
          }}
          aria-label="Captcha slider handle"
        >
          {status === "ok" ? (
            <IoCheckmarkCircle size={20} className="text-white" />
          ) : (
            <IoChevronForward size={20} className="text-[#110D14]" />
          )}
        </button>
      </div>

      {message && (
        <p
          className="mt-1.5 flex items-center gap-1 text-[13px] font-medium"
          style={{ color: status === "ok" ? "#17B15E" : "#FD565C" }}
          role="status"
          aria-live="polite"
        >
          {status === "ok" ? (
            <IoCheckmarkCircle size={14} />
          ) : (
            <IoCloseCircle size={14} />
          )}
          {message}
        </p>
      )}
    </div>
  );
}
