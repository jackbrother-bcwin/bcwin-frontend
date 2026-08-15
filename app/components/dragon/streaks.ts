/**
 * Dragon Assistant (长龙) — consecutive-outcome streaks from recent results.
 */

export type DragonGame = "wingo" | "trxwingo" | "k3" | "5d";

export type DragonBetPayload =
  | {
      game: "wingo" | "trxwingo";
      betType: "COLOR" | "NUMBER" | "SIZE";
      betChoice: string;
    }
  | {
      game: "k3";
      betType: string;
      betChoice: string;
    }
  | {
      game: "5d";
      betCategory: "SUM";
      betType: string;
      betChoice: string;
    };

export interface StreakMarket {
  id: string;
  label: string;
  short: string;
  theme: "red" | "green" | "violet" | "orange" | "blue";
  /** Non-null when this market's side is the outcome of the row */
  extract: (row: Record<string, unknown>) => string | null;
  sameBet: DragonBetPayload;
  oppositeBet: DragonBetPayload;
  oppositeLabel: string;
  oppositeShort: string;
  oppositeTheme: "red" | "green" | "violet" | "orange" | "blue";
}

export interface StreakItem {
  game: DragonGame;
  gameLabel: string;
  duration: number;
  durationLabel: string;
  marketId: string;
  marketLabel: string;
  marketShort: string;
  theme: StreakMarket["theme"];
  count: number;
  trail: string[];
  sameBet: DragonBetPayload;
  oppositeBet: DragonBetPayload;
  oppositeLabel: string;
  oppositeShort: string;
  oppositeTheme: StreakMarket["theme"];
}

const DUR_LABEL: Record<number, string> = {
  30: "30s",
  60: "1 Min",
  180: "3 Min",
  300: "5 Min",
  600: "10 Min",
};

export function durationLabel(sec: number): string {
  return DUR_LABEL[sec] ?? `${sec}s`;
}

function wingoSize(row: Record<string, unknown>): "BIG" | "SMALL" | null {
  const s = String(row.resultSize ?? "").toUpperCase();
  if (s === "BIG" || s === "SMALL") return s;
  const n = Number(row.resultNumber);
  if (!Number.isFinite(n)) return null;
  return n >= 5 ? "BIG" : "SMALL";
}

function wingoColor(row: Record<string, unknown>): "RED" | "GREEN" | "VIOLET" | null {
  const c = String(row.resultColor ?? "").toUpperCase();
  if (c === "RED" || c === "GREEN" || c === "VIOLET") return c;
  const n = Number(row.resultNumber);
  if (!Number.isFinite(n)) return null;
  if (n === 0 || n === 5) return "VIOLET";
  return n % 2 === 1 ? "GREEN" : "RED";
}

function k3Size(row: Record<string, unknown>): "BIG" | "SMALL" | null {
  if (row.isBig === true) return "BIG";
  if (row.isSmall === true) return "SMALL";
  const sum = Number(row.sum);
  if (!Number.isFinite(sum)) return null;
  return sum >= 11 ? "BIG" : "SMALL";
}

function k3Parity(row: Record<string, unknown>): "ODD" | "EVEN" | null {
  if (row.isOdd === true) return "ODD";
  if (row.isEven === true) return "EVEN";
  const sum = Number(row.sum);
  if (!Number.isFinite(sum)) return null;
  return sum % 2 === 1 ? "ODD" : "EVEN";
}

function fiveDSize(row: Record<string, unknown>): "HIGH" | "LOW" | null {
  const sum = Number(row.resultSum);
  if (!Number.isFinite(sum)) return null;
  return sum >= 23 ? "HIGH" : "LOW";
}

function fiveDParity(row: Record<string, unknown>): "ODD" | "EVEN" | null {
  const sum = Number(row.resultSum);
  if (!Number.isFinite(sum)) return null;
  return sum % 2 === 1 ? "ODD" : "EVEN";
}

export function marketsForGame(game: DragonGame): StreakMarket[] {
  if (game === "wingo" || game === "trxwingo") {
    const g = game;
    return [
      {
        id: "size-big",
        label: "Big",
        short: "B",
        theme: "orange",
        extract: (r) => (wingoSize(r) === "BIG" ? "BIG" : null),
        sameBet: { game: g, betType: "SIZE", betChoice: "BIG" },
        oppositeBet: { game: g, betType: "SIZE", betChoice: "SMALL" },
        oppositeLabel: "Small",
        oppositeShort: "S",
        oppositeTheme: "blue",
      },
      {
        id: "size-small",
        label: "Small",
        short: "S",
        theme: "blue",
        extract: (r) => (wingoSize(r) === "SMALL" ? "SMALL" : null),
        sameBet: { game: g, betType: "SIZE", betChoice: "SMALL" },
        oppositeBet: { game: g, betType: "SIZE", betChoice: "BIG" },
        oppositeLabel: "Big",
        oppositeShort: "B",
        oppositeTheme: "orange",
      },
      {
        id: "color-green",
        label: "Green",
        short: "G",
        theme: "green",
        extract: (r) => (wingoColor(r) === "GREEN" ? "GREEN" : null),
        sameBet: { game: g, betType: "COLOR", betChoice: "GREEN" },
        oppositeBet: { game: g, betType: "COLOR", betChoice: "RED" },
        oppositeLabel: "Red",
        oppositeShort: "R",
        oppositeTheme: "red",
      },
      {
        id: "color-red",
        label: "Red",
        short: "R",
        theme: "red",
        extract: (r) => (wingoColor(r) === "RED" ? "RED" : null),
        sameBet: { game: g, betType: "COLOR", betChoice: "RED" },
        oppositeBet: { game: g, betType: "COLOR", betChoice: "GREEN" },
        oppositeLabel: "Green",
        oppositeShort: "G",
        oppositeTheme: "green",
      },
    ];
  }

  if (game === "k3") {
    return [
      {
        id: "k3-big",
        label: "Big",
        short: "B",
        theme: "orange",
        extract: (r) => (k3Size(r) === "BIG" ? "BIG" : null),
        sameBet: { game: "k3", betType: "BIG", betChoice: "BIG" },
        oppositeBet: { game: "k3", betType: "SMALL", betChoice: "SMALL" },
        oppositeLabel: "Small",
        oppositeShort: "S",
        oppositeTheme: "blue",
      },
      {
        id: "k3-small",
        label: "Small",
        short: "S",
        theme: "blue",
        extract: (r) => (k3Size(r) === "SMALL" ? "SMALL" : null),
        sameBet: { game: "k3", betType: "SMALL", betChoice: "SMALL" },
        oppositeBet: { game: "k3", betType: "BIG", betChoice: "BIG" },
        oppositeLabel: "Big",
        oppositeShort: "B",
        oppositeTheme: "orange",
      },
      {
        id: "k3-odd",
        label: "Odd",
        short: "O",
        theme: "green",
        extract: (r) => (k3Parity(r) === "ODD" ? "ODD" : null),
        sameBet: { game: "k3", betType: "ODD", betChoice: "ODD" },
        oppositeBet: { game: "k3", betType: "EVEN", betChoice: "EVEN" },
        oppositeLabel: "Even",
        oppositeShort: "E",
        oppositeTheme: "red",
      },
      {
        id: "k3-even",
        label: "Even",
        short: "E",
        theme: "red",
        extract: (r) => (k3Parity(r) === "EVEN" ? "EVEN" : null),
        sameBet: { game: "k3", betType: "EVEN", betChoice: "EVEN" },
        oppositeBet: { game: "k3", betType: "ODD", betChoice: "ODD" },
        oppositeLabel: "Odd",
        oppositeShort: "O",
        oppositeTheme: "green",
      },
    ];
  }

  return [
    {
      id: "5d-high",
      label: "Sum Big",
      short: "B",
      theme: "orange",
      extract: (r) => (fiveDSize(r) === "HIGH" ? "HIGH" : null),
      sameBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "HIGH",
        betChoice: "HIGH",
      },
      oppositeBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "LOW",
        betChoice: "LOW",
      },
      oppositeLabel: "Sum Small",
      oppositeShort: "S",
      oppositeTheme: "blue",
    },
    {
      id: "5d-low",
      label: "Sum Small",
      short: "S",
      theme: "blue",
      extract: (r) => (fiveDSize(r) === "LOW" ? "LOW" : null),
      sameBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "LOW",
        betChoice: "LOW",
      },
      oppositeBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "HIGH",
        betChoice: "HIGH",
      },
      oppositeLabel: "Sum Big",
      oppositeShort: "B",
      oppositeTheme: "orange",
    },
    {
      id: "5d-odd",
      label: "Sum Odd",
      short: "O",
      theme: "green",
      extract: (r) => (fiveDParity(r) === "ODD" ? "ODD" : null),
      sameBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "ODD",
        betChoice: "ODD",
      },
      oppositeBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "EVEN",
        betChoice: "EVEN",
      },
      oppositeLabel: "Sum Even",
      oppositeShort: "E",
      oppositeTheme: "red",
    },
    {
      id: "5d-even",
      label: "Sum Even",
      short: "E",
      theme: "red",
      extract: (r) => (fiveDParity(r) === "EVEN" ? "EVEN" : null),
      sameBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "EVEN",
        betChoice: "EVEN",
      },
      oppositeBet: {
        game: "5d",
        betCategory: "SUM",
        betType: "ODD",
        betChoice: "ODD",
      },
      oppositeLabel: "Sum Odd",
      oppositeShort: "O",
      oppositeTheme: "green",
    },
  ];
}

export interface GameSource {
  game: DragonGame;
  gameLabel: string;
  durations: number[];
}

export const DRAGON_SOURCES: GameSource[] = [
  { game: "wingo", gameLabel: "WinGo", durations: [30, 60, 180, 300] },
  { game: "trxwingo", gameLabel: "TrxWinGo", durations: [60, 180, 300, 600] },
  { game: "k3", gameLabel: "K3", durations: [30, 60, 180, 300] },
  { game: "5d", gameLabel: "5D", durations: [30, 60, 180, 300] },
];

/** Min consecutive periods to list a streak (matches Dragon Assistant banner: 5) */
export const MIN_STREAK = 5;

export function computeMarketStreak(
  results: Record<string, unknown>[],
  market: StreakMarket
): { count: number; trail: string[] } {
  let count = 0;
  const trail: string[] = [];
  for (const row of results) {
    const key = market.extract(row);
    if (key == null) break;
    count += 1;
    trail.push(market.short);
    if (count >= 12) break;
  }
  return { count, trail };
}

export function buildStreaks(
  game: DragonGame,
  gameLabel: string,
  duration: number,
  results: Record<string, unknown>[]
): StreakItem[] {
  const markets = marketsForGame(game);
  const out: StreakItem[] = [];
  for (const m of markets) {
    const { count, trail } = computeMarketStreak(results, m);
    if (count < MIN_STREAK) continue;
    out.push({
      game,
      gameLabel,
      duration,
      durationLabel: durationLabel(duration),
      marketId: m.id,
      marketLabel: m.label,
      marketShort: m.short,
      theme: m.theme,
      count,
      trail,
      sameBet: m.sameBet,
      oppositeBet: m.oppositeBet,
      oppositeLabel: m.oppositeLabel,
      oppositeShort: m.oppositeShort,
      oppositeTheme: m.oppositeTheme,
    });
  }
  return out;
}

