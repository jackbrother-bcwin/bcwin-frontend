/**
 * SPA ↔ Browser History bridge.
 * Phone swipe-back / browser Back stay inside BCWin via pushState + popstate.
 *
 * URL:   /#/home/wallet/deposit
 * State: { spa: true, stack: string[], gen: number }
 */

export type SpaHistoryState = {
  spa: true;
  stack: string[];
  /** Monotonic generation — lets us know entry belongs to this session */
  gen: number;
  /** Open overlay ids at this history entry (modals / sheets / nested views) */
  overlays?: string[];
};

let genCounter = 0;

export function nextGen(): number {
  genCounter += 1;
  return genCounter;
}

export function isSpaHistoryState(v: unknown): v is SpaHistoryState {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.spa === true &&
    Array.isArray(o.stack) &&
    (o.stack as unknown[]).length > 0
  );
}

export function stackToHash(stack: string[]): string {
  const parts = stack.map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return "#/home";
  return `#/${parts.map(encodeURIComponent).join("/")}`;
}

export function parseHash(hash: string): string[] | null {
  if (!hash || hash === "#" || hash === "#/") return null;
  const raw = hash.replace(/^#\/?/, "").trim();
  if (!raw) return null;
  const parts = raw
    .split("/")
    .map((s) => {
      try {
        return decodeURIComponent(s.trim());
      } catch {
        return s.trim();
      }
    })
    .filter(Boolean);
  return parts.length ? parts : null;
}

export function pushSpaHistory(stack: string[]): void {
  if (typeof window === "undefined") return;
  const next: SpaHistoryState = {
    spa: true,
    stack: [...stack],
    gen: nextGen(),
  };
  window.history.pushState(next, "", stackToHash(stack));
}

export function replaceSpaHistory(stack: string[]): void {
  if (typeof window === "undefined") return;
  const next: SpaHistoryState = {
    spa: true,
    stack: [...stack],
    gen: nextGen(),
  };
  window.history.replaceState(next, "", stackToHash(stack));
}

/**
 * After landing, ensure at least two SPA history entries so the first
 * system-back cannot jump to the previous website.
 */
export function bootstrapSpaHistory(stack: string[]): void {
  if (typeof window === "undefined") return;
  replaceSpaHistory(stack);
  // Sentinel: second identical entry acts as a trap pad
  pushSpaHistory(stack);
}

/** Re-push current stack to absorb a back that would leave the site */
export function trapSpaHistory(stack: string[]): void {
  if (typeof window === "undefined") return;
  pushSpaHistory(stack);
}

export function capStack(stack: string[], max: number): string[] {
  if (stack.length <= max) return stack;
  return stack.slice(-max);
}

export function stacksEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s === b[i]);
}

/**
 * Overlay dismiss used to replace() the current entry, leaving duplicate
 * nested screens behind. Those slots always stamp `overlays` (even `[]`).
 * Real screen pushes and the root trap pad omit the field — do not skip them.
 */
export function isLeftoverOverlaySlot(
  state: unknown,
  currentStack: string[]
): boolean {
  if (!isSpaHistoryState(state)) return false;
  if (!Array.isArray(state.overlays)) return false;
  if (currentStack.length <= 1) return false;
  return stacksEqual(state.stack, currentStack);
}
