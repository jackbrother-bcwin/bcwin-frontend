/**
 * SPA overlay / dialog back-stack.
 * Opens push a history entry; system-back / swipe-back closes top overlay
 * before leaving the current screen. Coordinates with AppShell popstate.
 */

import {
  isSpaHistoryState,
  nextGen,
  stackToHash,
  type SpaHistoryState,
} from "./spa-history";

export type SpaOverlayEntry = {
  id: string;
  onClose: () => void;
};

let overlays: SpaOverlayEntry[] = [];
/** history.back() after UI close — ignore one pop */
let suppressNextPop = false;
/** onClose was invoked from popstate — don't history.back again */
const closedViaPop = new Set<string>();

function currentNavStack(): string[] {
  if (typeof window === "undefined") return ["home"];
  const st = window.history.state;
  if (isSpaHistoryState(st) && st.stack.length) return [...st.stack];
  return ["home"];
}

function pushHistoryWithOverlays(): void {
  if (typeof window === "undefined") return;
  const stack = currentNavStack();
  const next: SpaHistoryState & { overlays: string[] } = {
    spa: true,
    stack,
    gen: nextGen(),
    overlays: overlays.map((o) => o.id),
  };
  // Same hash — only state depth changes (modals shouldn't change URL path)
  window.history.pushState(next, "", stackToHash(stack));
}

/**
 * Register an open overlay (modal, sheet, nested agency view, dragon, …).
 * Pushes browser history so system-back closes it first.
 */
export function pushSpaOverlay(id: string, onClose: () => void): void {
  if (typeof window === "undefined") return;
  // Replace same id if re-opened
  overlays = overlays.filter((o) => o.id !== id);
  overlays.push({ id, onClose });
  pushHistoryWithOverlays();
}

/**
 * UI close (X / cancel). Removes overlay and pops history if it was top.
 */
export function dismissSpaOverlay(id: string): void {
  if (typeof window === "undefined") return;

  if (closedViaPop.has(id)) {
    closedViaPop.delete(id);
    return;
  }

  const idx = overlays.findIndex((o) => o.id === id);
  if (idx < 0) return;

  const isTop = idx === overlays.length - 1;
  overlays = overlays.filter((o) => o.id !== id);

  if (isTop) {
    suppressNextPop = true;
    window.history.back();
  }
}

/**
 * Call from AppShell popstate **first**.
 * @returns true if an overlay consumed the back gesture
 */
export function consumeSpaOverlayPop(): boolean {
  if (typeof window === "undefined") return false;

  if (suppressNextPop) {
    suppressNextPop = false;
    return true;
  }

  if (overlays.length === 0) return false;

  const top = overlays.pop()!;
  closedViaPop.add(top.id);
  try {
    top.onClose();
  } catch {
    closedViaPop.delete(top.id);
  }
  return true;
}

export function spaOverlayDepth(): number {
  return overlays.length;
}

export function clearAllSpaOverlays(): void {
  const copy = [...overlays];
  overlays = [];
  for (const o of copy) {
    try {
      o.onClose();
    } catch {
      /* ignore */
    }
  }
}
