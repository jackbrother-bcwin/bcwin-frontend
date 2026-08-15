/**
 * Shared helpers for game pages: prevent poll storms when countdown hits 0,
 * while keeping period/result correctness (WS + light poll still work).
 */

/** Call `fn` at most once until `resetKey` changes (e.g. new period endTime). */
export function createOncePerKey() {
  let lastKey: string | null = null;
  let inFlight = false;

  return {
    /** Returns true if `fn` was started (not skipped). */
    run(key: string, fn: () => void | Promise<void>): boolean {
      if (!key || key === lastKey || inFlight) return false;
      lastKey = key;
      inFlight = true;
      Promise.resolve(fn()).finally(() => {
        inFlight = false;
      });
      return true;
    },
    clear() {
      lastKey = null;
      inFlight = false;
    },
  };
}

/** Skip React state updates when the displayed second hasn't changed. */
export function setCountdownIfChanged(
  setCountdown: (updater: (prev: number) => number) => void,
  next: number
) {
  setCountdown((prev) => (prev === next ? prev : next));
}
