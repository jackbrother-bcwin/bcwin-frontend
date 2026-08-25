"use client";

import { asset } from "../../lib/cdn";
import React, { useCallback, useEffect, useState } from "react";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import Image from "next/image";

const STORAGE_HIDE_UNTIL = "bcwin_a2d_hide_until";
const STORAGE_INSTALLED = "bcwin_a2d_installed";
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // show again after 6h when dismissed

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mq || ios);
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function readHideUntil(): number {
  try {
    return Number(localStorage.getItem(STORAGE_HIDE_UNTIL) || 0) || 0;
  } catch {
    return 0;
  }
}

function markInstalled() {
  try {
    localStorage.setItem(STORAGE_INSTALLED, "1");
  } catch {
    /* private mode */
  }
}

function isMarkedInstalled(): boolean {
  try {
    return localStorage.getItem(STORAGE_INSTALLED) === "1";
  } catch {
    return false;
  }
}

/**
 * Floating “Add to Desktop” with real install when available.
 * Tiny × dismisses for 6 hours; installed / standalone never shows.
 */
export default function AddToDesktop() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [iosTip, setIosTip] = useState(false);
  useSpaBackClose(iosTip, () => setIosTip(false), "add-to-desktop-tip");
  const [hint, setHint] = useState<string | null>(null);

  const shouldShow = useCallback(() => {
    if (typeof window === "undefined") return false;
    if (isStandalone() || isMarkedInstalled()) return false;
    if (Date.now() < readHideUntil()) return false;
    return true;
  }, []);

  useEffect(() => {
    if (!shouldShow()) {
      setVisible(false);
      return;
    }
    setVisible(true);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (shouldShow()) setVisible(true);
    };
    const onInstalled = () => {
      markInstalled();
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [shouldShow]);

  const dismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    try {
      localStorage.setItem(STORAGE_HIDE_UNTIL, String(Date.now() + COOLDOWN_MS));
    } catch {
      /* ignore */
    }
    setVisible(false);
    setIosTip(false);
    setHint(null);
  };

  const handleInstall = async () => {
    if (busy) return;
    setHint(null);

    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        setDeferred(null);
        if (choice.outcome === "accepted") {
          markInstalled();
          setVisible(false);
        } else {
          dismiss();
        }
      } catch {
        setHint("Use browser menu → Install app / Add to Home screen.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (isIosSafari()) {
      setIosTip(true);
      return;
    }

    setHint("Open browser menu → Install app or Add to Home screen.");
  };

  if (!visible) return null;

  return (
    <>
      <div className="app-fixed-chrome pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-30 flex justify-center px-4">
        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={dismiss}
            className="home-add-desktop-x"
            aria-label="Dismiss add to desktop"
            title="Dismiss"
          >
            ×
          </button>

          <button
            type="button"
            className="home-add-desktop"
            onClick={handleInstall}
            disabled={busy}
            aria-label="Add BCWin to desktop"
          >
            <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded">
              <Image
                src={asset("/assets/png/bcwin.png")}
                alt=""
                fill
                sizes="20px"
                className="object-contain"
              />
            </span>
            {busy ? "Installing…" : "Add to Desktop"}
          </button>

          {hint && (
            <p
              className="absolute left-1/2 top-full z-10 mt-1.5 w-[min(280px,88vw)] -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-center text-[12px] font-medium leading-snug text-[#FDE4BC]"
              style={{
                background: "rgba(36,30,34,0.96)",
                border: "1px solid rgba(254,211,88,0.28)",
              }}
            >
              {hint}
            </p>
          )}
        </div>
      </div>

      {iosTip && (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setIosTip(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How to add to home screen"
        >
          <div
            className="relative w-full max-w-[340px] rounded-2xl p-4"
            style={{
              background: "linear-gradient(180deg,#241E22 0%,#1a1519 100%)",
              border: "1px solid rgba(254,211,88,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="home-add-desktop-x !-right-1 !-top-1"
              onClick={() => {
                setIosTip(false);
                dismiss();
              }}
              aria-label="Close"
            >
              ×
            </button>
            <p className="mb-2 text-center text-[16px] font-black text-[#FED358]">
              Add BCWin to Home Screen
            </p>
            <ol className="space-y-2 text-[14px] leading-relaxed text-white/70">
              <li>
                1. Tap <strong className="text-white">Share</strong> in Safari.
              </li>
              <li>
                2. Tap <strong className="text-white">Add to Home Screen</strong>.
              </li>
              <li>
                3. Tap <strong className="text-white">Add</strong>.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => {
                setIosTip(false);
                dismiss();
              }}
              className="mt-4 h-10 w-full rounded-full text-[15px] font-bold text-[#110D14]"
              style={{ background: "linear-gradient(180deg,#FED358,#FFB472)" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
