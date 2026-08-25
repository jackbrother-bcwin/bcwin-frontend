/**
 * Overlay dismiss must pop its history entry when still on that screen,
 * and must not pop a screen that was already pushed on the same tap.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import {
  consumeSpaOverlayPop,
  dismissSpaOverlay,
  pushSpaOverlay,
  spaOverlayDepth,
} from "./spa-overlay";
import {
  isLeftoverOverlaySlot,
  pushSpaHistory,
  replaceSpaHistory,
  stacksEqual,
} from "./spa-history";

type HistEntry = { state: unknown; url: string };

function installMockHistory(initial: HistEntry): {
  entries: () => HistEntry[];
  index: () => number;
} {
  const stack: HistEntry[] = [initial];
  let idx = 0;
  const history = {
    get state() {
      return stack[idx]?.state ?? null;
    },
    pushState(state: unknown, _title: string, url?: string | URL | null) {
      stack.splice(idx + 1);
      stack.push({ state, url: String(url ?? "") });
      idx = stack.length - 1;
    },
    replaceState(state: unknown, _title: string, url?: string | URL | null) {
      const cur = stack[idx] ?? initial;
      stack[idx] = { state, url: url != null ? String(url) : cur.url };
    },
    back() {
      if (idx <= 0) return;
      idx -= 1;
    },
  };
  const win = globalThis as unknown as { window: { history: typeof history } };
  win.window = { history };
  return {
    entries: () => stack.slice(),
    index: () => idx,
  };
}

describe("SPA overlay history", () => {
  beforeEach(() => {
    const hist = installMockHistory({
      state: { spa: true, stack: ["home", "wingo"], gen: 1 },
      url: "#/home/wingo",
    });
    // Drain any leftover overlay from a prior test
    while (spaOverlayDepth() > 0) {
      consumeSpaOverlayPop();
    }
    consumeSpaOverlayPop();
    void hist;
  });

  test("dismiss pops overlay entry so one Back leaves Win Go", () => {
    const hist = installMockHistory({
      state: { spa: true, stack: ["home", "wingo"], gen: 1 },
      url: "#/home/wingo",
    });
    pushSpaHistory(["home", "wingo"]);
    const before = hist.entries().length;

    pushSpaOverlay("bet-slip", () => undefined);
    expect(hist.entries().length).toBe(before + 1);
    expect(spaOverlayDepth()).toBe(1);

    dismissSpaOverlay("bet-slip");
    expect(spaOverlayDepth()).toBe(0);
    expect(hist.entries().length).toBe(before + 1);
    expect(hist.index()).toBe(before - 1);
    expect(consumeSpaOverlayPop()).toBe(true);

    const cur = hist.entries()[hist.index()]!.state as { stack: string[] };
    expect(cur.stack).toEqual(["home", "wingo"]);
  });

  test("four table bets leave a single Win Go history entry", () => {
    const hist = installMockHistory({
      state: { spa: true, stack: ["home"], gen: 1 },
      url: "#/home",
    });
    pushSpaHistory(["home", "wingo"]);
    const wingoIndex = hist.index();

    for (let i = 0; i < 4; i++) {
      pushSpaOverlay("bet-slip", () => undefined);
      dismissSpaOverlay("bet-slip");
      expect(consumeSpaOverlayPop()).toBe(true);
    }

    expect(spaOverlayDepth()).toBe(0);
    expect(hist.index()).toBe(wingoIndex);
    const cur = hist.entries()[hist.index()]!.state as { stack: string[] };
    expect(cur.stack).toEqual(["home", "wingo"]);
  });

  test("same-tap navigate is not eaten by overlay dismiss", () => {
    const hist = installMockHistory({
      state: { spa: true, stack: ["home"], gen: 1 },
      url: "#/home",
    });
    pushSpaOverlay("daily-promo-popup", () => undefined);
    pushSpaHistory(["home", "deposit"]);

    dismissSpaOverlay("daily-promo-popup");
    expect(spaOverlayDepth()).toBe(0);

    const cur = hist.entries()[hist.index()]!.state as { stack: string[] };
    expect(cur.stack).toEqual(["home", "deposit"]);
    expect(hist.index()).toBe(hist.entries().length - 1);
  });

  test("leftover overlay slot is skippable; root trap is not", () => {
    expect(
      isLeftoverOverlaySlot(
        { spa: true, stack: ["home", "wingo"], gen: 2, overlays: [] },
        ["home", "wingo"]
      )
    ).toBe(true);
    expect(
      isLeftoverOverlaySlot(
        { spa: true, stack: ["home", "wingo"], gen: 2 },
        ["home", "wingo"]
      )
    ).toBe(false);
    expect(
      isLeftoverOverlaySlot(
        { spa: true, stack: ["home"], gen: 2, overlays: [] },
        ["home"]
      )
    ).toBe(false);
    expect(stacksEqual(["home", "wingo"], ["home", "wingo"])).toBe(true);
    expect(stacksEqual(["home", "wingo"], ["home"])).toBe(false);
  });
});
