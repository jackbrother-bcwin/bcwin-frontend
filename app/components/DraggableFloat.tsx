"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export type FloatPos = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function loadPos(storageKey: string): FloatPos | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const p = JSON.parse(raw) as FloatPos;
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(storageKey: string, pos: FloatPos) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

function defaultBottomRight(size: number, offsetBottom: number, offsetRight: number): FloatPos {
  if (typeof window === "undefined") {
    return { x: 0, y: 0 };
  }
  const safeR = 0;
  const safeB = 0;
  return {
    x: window.innerWidth - size - offsetRight - safeR,
    y: window.innerHeight - size - offsetBottom - safeB,
  };
}

interface DraggableFloatProps {
  /** Unique id — used for localStorage position key */
  id: string;
  /** Button size in px */
  size?: number;
  /** Default offset from bottom (when no saved pos) */
  defaultBottom?: number;
  /** Default offset from right (when no saved pos) */
  defaultRight?: number;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  onClick?: () => void;
  children: React.ReactNode;
}

/**
 * Fixed floating control that the user can drag anywhere on screen.
 * Click (without drag) fires onClick. Position persists per `id`.
 */
export default function DraggableFloat({
  id,
  size = 52,
  defaultBottom = 96,
  defaultRight = 12,
  zIndex = 40,
  className = "",
  style,
  "aria-label": ariaLabel,
  onClick,
  children,
}: DraggableFloatProps) {
  const storageKey = `bcwin-float-${id}`;
  const [pos, setPos] = useState<FloatPos>(() =>
    defaultBottomRight(size, defaultBottom, defaultRight)
  );
  const [ready, setReady] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const constrain = useCallback(
    (p: FloatPos): FloatPos => {
      if (typeof window === "undefined") return p;
      const pad = 4;
      const maxX = Math.max(pad, window.innerWidth - size - pad);
      const maxY = Math.max(pad, window.innerHeight - size - pad);
      return {
        x: clamp(p.x, pad, maxX),
        y: clamp(p.y, pad, maxY),
      };
    },
    [size]
  );

  useEffect(() => {
    const saved = loadPos(storageKey);
    const next = constrain(
      saved ?? defaultBottomRight(size, defaultBottom, defaultRight)
    );
    setPos(next);
    setReady(true);
  }, [storageKey, size, defaultBottom, defaultRight, constrain]);

  useEffect(() => {
    const onResize = () => setPos((p) => constrain(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [constrain]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    moved.current = false;
    start.current = {
      px: e.clientX,
      py: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.px;
    const dy = e.clientY - start.current.py;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
    setPos(
      constrain({
        x: start.current.ox + dx,
        y: start.current.oy + dy,
      })
    );
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    savePos(storageKey, posRef.current);
    if (!moved.current) onClick?.();
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`fixed touch-none select-none active:scale-95 transition-[transform,opacity] ${
        ready ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{
        left: pos.x,
        top: pos.y,
        width: size,
        height: size,
        zIndex,
        ...style,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </button>
  );
}
