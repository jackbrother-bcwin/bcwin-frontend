"use client";

import { useEffect } from "react";

/**
 * Production mobile shell: block pinch / double-tap / iOS gesture zoom
 * so the SPA feels like a native app. Skips /greebuserrichadmin (desktop tools).
 *
 * Viewport meta (maximum-scale=1, user-scalable=no) handles most browsers;
 * this covers remaining iOS Safari / Android WebView edge cases.
 */
export default function MobileViewportGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/greebuserrichadmin")) return;

    const onGesture = (e: Event) => {
      e.preventDefault();
    };

    // iOS Safari legacy gesture events
    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("gestureend", onGesture, { passive: false });

    // Multi-touch pinch (some Android WebViews ignore viewport max-scale)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    // Double-tap zoom (iOS) — skip interactive controls so rapid taps still work
    let lastTouchEnd = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t?.closest?.(
          "button, a, input, textarea, select, label, [role='button'], [role='dialog'], [role='listbox'], dialog, .promo-modal-overlay, [contenteditable='true']"
        )
      ) {
        lastTouchEnd = Date.now();
        return;
      }
      const now = Date.now();
      if (now - lastTouchEnd <= 280) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };
    document.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}
