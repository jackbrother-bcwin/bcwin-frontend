"use client";

/**
 * Full-screen in-app shell for third-party (Inout) games.
 * Prefer iframe (no new Chrome tab on Android).
 * "Open outside" is only a small header icon — never a bar over the game.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { IoChevronBack, IoOpenOutline, IoRefresh } from "react-icons/io5";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { isSafeHttpUrl, openSafeUrl } from "../../lib/safe";

export type ThirdPartyGameSession = {
  url: string;
  title: string;
};

interface Props {
  session: ThirdPartyGameSession | null;
  onClose: () => void;
}

export default function ThirdPartyGameShell({ session, onClose }: Props) {
  const open = Boolean(session?.url && isSafeHttpUrl(session.url));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedOk = useRef(false);

  useSpaBackClose(open, onClose, "third-party-game");
  useBodyScrollLock(open);

  // Tell AppShell to hide bottom nav + floating buttons (they sit above this tree)
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("bcwin-tp-game", { detail: { open } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("bcwin-tp-game", { detail: { open: false } })
      );
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setLoadError(false);
      loadedOk.current = false;
    }
  }, [open, session?.url, frameKey]);

  // Iframe always fires onLoad even for HTTP 400 HTML pages (cross-origin).
  // After a grace period, if still "loading" or user stuck — offer fallback.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setLoading(false);
      // Don't auto-force error; keep iframe visible (may still work for some providers)
    }, 8_000);
    return () => window.clearTimeout(t);
  }, [open, frameKey]);

  const reload = useCallback(() => {
    setFrameKey((k) => k + 1);
    setLoading(true);
    setLoadError(false);
    loadedOk.current = false;
  }, []);

  const openExternal = useCallback(() => {
    if (session?.url) {
      const ok = openSafeUrl(session.url);
      if (!ok) {
        // Last resort: same-tab navigate (still better than dead iframe on WebView)
        try {
          window.location.assign(session.url);
        } catch {
          /* ignore */
        }
      }
    }
  }, [session?.url]);

  if (!open || !session) return null;

  return (
    <div
      className="tp-game-shell"
      role="dialog"
      aria-modal="true"
      aria-label={session.title || "Game"}
    >
      <header className="tp-game-header">
        <button
          type="button"
          className="tp-game-header-btn"
          onClick={onClose}
          aria-label="Back"
        >
          <IoChevronBack size={22} />
        </button>
        <h1 className="tp-game-title">{session.title || "Game"}</h1>
        <div className="tp-game-header-actions">
          <button
            type="button"
            className="tp-game-header-btn"
            onClick={reload}
            aria-label="Reload"
            title="Reload"
          >
            <IoRefresh size={20} />
          </button>
          <button
            type="button"
            className="tp-game-header-btn"
            onClick={openExternal}
            aria-label="Open outside"
            title="Open outside app"
          >
            <IoOpenOutline size={20} />
          </button>
        </div>
      </header>

      <div className="tp-game-stage">
        {loading ? (
          <div className="tp-game-loading" aria-live="polite">
            <div className="tp-game-spinner" />
            <p>Loading {session.title}…</p>
          </div>
        ) : null}

        {loadError ? (
          <div className="tp-game-error">
            <p>This game could not load inside the app.</p>
            <p className="tp-game-error-sub">
              The provider may block embedded play, or launch credentials are
              invalid (check operator id). Try open outside or contact support.
            </p>
            <div className="tp-game-error-actions">
              <button type="button" className="tp-game-btn-secondary" onClick={reload}>
                Retry in app
              </button>
              <button type="button" className="tp-game-btn-primary" onClick={openExternal}>
                Open outside
              </button>
            </div>
          </div>
        ) : null}

        <iframe
          key={frameKey}
          ref={iframeRef}
          className="tp-game-iframe"
          src={session.url}
          title={session.title || "Third-party game"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; payment; fullscreen; web-share"
          allowFullScreen
          // Keep referrer so some operators can whitelist our domain
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            setLoading(false);
            loadedOk.current = true;
            setLoadError(false);
          }}
          onError={() => {
            setLoading(false);
            setLoadError(true);
          }}
        />
      </div>
    </div>
  );
}
