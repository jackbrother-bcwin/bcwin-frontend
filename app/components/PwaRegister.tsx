"use client";

import { useEffect } from "react";

/** Register production-safe SW; purge any legacy caches that cached HTML. */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    let cancelled = false;

    const run = async () => {
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter(
                (k) =>
                  k === "bcwin-shell-v1" ||
                  k === "bcwin-static-v2" ||
                  k.startsWith("bcwin-shell")
              )
              .map((k) => caches.delete(k))
          );
        }
        if (cancelled) return;
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await reg.update().catch(() => undefined);
      } catch {
        /* optional */
      }
    };

    if (document.readyState === "complete") void run();
    else window.addEventListener("load", () => void run(), { once: true });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
