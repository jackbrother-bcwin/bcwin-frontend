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
  return {
    x: window.innerWidth - size - offsetRight,
    y: window.innerHeight - size - offsetBottom,
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
 * Fixed floating control the user can drag. Position is GPU `translate3d`
 * updated on rAF (no React render per move). Click without drag fires onClick.
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
  const elRef = useRef<HTMLButtonElement>(null);
  const posRef = useRef<FloatPos>({ x: 0, y: 0 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ px: 0, py: 0, ox: 0, oy: 0 });
  const raf = useRef(0);
  const pending = useRef<FloatPos | null>(null);
  const [ready, setReady] = useState(false);

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

  const paint = useCallback((p: FloatPos) => {
    posRef.current = p;
    const el = elRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  }, []);

  const schedulePaint = useCallback(
    (p: FloatPos) => {
      pending.current = p;
      if (raf.current) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        const next = pending.current;
        if (next) paint(next);
      });
    },
    [paint]
  );

  useEffect(() => {
    const saved = loadPos(storageKey);
    const next = constrain(
      saved ?? defaultBottomRight(size, defaultBottom, defaultRight)
    );
    paint(next);
    setReady(true);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [storageKey, size, defaultBottom, defaultRight, constrain, paint]);

  useEffect(() => {
    const onResize = () => paint(constrain(posRef.current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [constrain, paint]);

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
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    el.style.willChange = "transform";
    el.style.transition = "none";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.px;
    const dy = e.clientY - start.current.py;
    if (!moved.current && (dx * dx + dy * dy) > 25) moved.current = true;
    schedulePaint(
      constrain({
        x: start.current.ox + dx,
        y: start.current.oy + dy,
      })
    );
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const el = e.currentTarget as HTMLElement;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    if (pending.current) {
      paint(pending.current);
      pending.current = null;
    }
    el.style.willChange = "";
    el.style.transition = "";
    savePos(storageKey, posRef.current);
    if (!moved.current) onClick?.();
  };

  return (
    <button
      ref={elRef}
      type="button"
      aria-label={ariaLabel}
      className={`fixed top-0 left-0 touch-none select-none ${
        ready ? "opacity-100" : "opacity-0"
      } ${className}`}
      style={{
        width: size,
        height: size,
        zIndex,
        transform: "translate3d(0,0,0)",
        ...style,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {children}
    </button>
  );
}
