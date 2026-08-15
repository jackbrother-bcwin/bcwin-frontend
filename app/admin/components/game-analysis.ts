/**
 * House-exposure analysis for admin prediction UI.
 * Approximates which outcomes would pay out based on open bets.
 */

export type LiveBet = {
  betType?: string;
  betChoice?: string;
  betAmount?: number;
  status?: string;
};

export type WingoNumberStats = {
  n: number;
  liability: number;
  directAmount: number;
  colorAmount: number;
  sizeAmount: number;
  betCount: number;
};

const GREEN = new Set([1, 3, 5, 7, 9]);
const RED = new Set([0, 2, 4, 6, 8]);
// Violet touches 0 and 5 (half-color in product; count full bet as risk)
const VIOLET = new Set([0, 5]);

function isOpen(b: LiveBet) {
  const s = String(b.status ?? "PENDING").toUpperCase();
  return !["SETTLED", "WON", "LOST", "CANCELLED", "CANCELED"].includes(s);
}

function matchesWingoNumber(b: LiveBet, n: number): boolean {
  const type = String(b.betType ?? "").toUpperCase();
  const choice = String(b.betChoice ?? "").toUpperCase();
  const amt = Number(b.betAmount ?? 0);
  if (!amt || !isOpen(b)) return false;

  if (type === "NUMBER" || type === "NUM") {
    return Number(choice) === n || choice === String(n);
  }
  if (type === "COLOR") {
    if (choice === "GREEN" || choice === "G") return GREEN.has(n);
    if (choice === "RED" || choice === "R") return RED.has(n);
    if (choice === "VIOLET" || choice === "V" || choice === "PURPLE") return VIOLET.has(n);
  }
  if (type === "SIZE") {
    if (choice === "BIG" || choice === "B") return n >= 5;
    if (choice === "SMALL" || choice === "S") return n <= 4;
  }
  // Fallback: raw choice looks like a number
  if (/^\d$/.test(choice)) return Number(choice) === n;
  if (choice === "GREEN") return GREEN.has(n);
  if (choice === "RED") return RED.has(n);
  if (choice === "VIOLET") return VIOLET.has(n);
  if (choice === "BIG") return n >= 5;
  if (choice === "SMALL") return n <= 4;
  return false;
}

export function analyzeWingoBets(bets: LiveBet[]): {
  byNumber: WingoNumberStats[];
  safest: number;
  riskiest: number;
  totalStake: number;
  byColor: { name: string; amount: number; count: number }[];
  bySize: { name: string; amount: number; count: number }[];
} {
  const byNumber: WingoNumberStats[] = Array.from({ length: 10 }, (_, n) => ({
    n,
    liability: 0,
    directAmount: 0,
    colorAmount: 0,
    sizeAmount: 0,
    betCount: 0,
  }));

  let totalStake = 0;
  const colorMap = new Map<string, { amount: number; count: number }>();
  const sizeMap = new Map<string, { amount: number; count: number }>();

  for (const b of bets) {
    if (!isOpen(b)) continue;
    const amt = Number(b.betAmount ?? 0);
    if (!amt) continue;
    totalStake += amt;
    const type = String(b.betType ?? "").toUpperCase();
    const choice = String(b.betChoice ?? "").toUpperCase();

    if (type === "COLOR" || ["GREEN", "RED", "VIOLET"].includes(choice)) {
      const key = choice || type;
      const prev = colorMap.get(key) ?? { amount: 0, count: 0 };
      prev.amount += amt;
      prev.count += 1;
      colorMap.set(key, prev);
    }
    if (type === "SIZE" || ["BIG", "SMALL"].includes(choice)) {
      const key = choice || type;
      const prev = sizeMap.get(key) ?? { amount: 0, count: 0 };
      prev.amount += amt;
      prev.count += 1;
      sizeMap.set(key, prev);
    }

    for (let n = 0; n < 10; n++) {
      if (!matchesWingoNumber(b, n)) continue;
      const row = byNumber[n]!;
      row.liability += amt;
      row.betCount += 1;
      if (type === "NUMBER" || /^\d$/.test(choice)) row.directAmount += amt;
      else if (type === "COLOR" || ["GREEN", "RED", "VIOLET"].includes(choice)) row.colorAmount += amt;
      else if (type === "SIZE" || ["BIG", "SMALL"].includes(choice)) row.sizeAmount += amt;
    }
  }

  let safest = 0;
  let riskiest = 0;
  for (let n = 1; n < 10; n++) {
    if (byNumber[n]!.liability < byNumber[safest]!.liability) safest = n;
    if (byNumber[n]!.liability > byNumber[riskiest]!.liability) riskiest = n;
  }

  return {
    byNumber,
    safest,
    riskiest,
    totalStake,
    byColor: Array.from(colorMap.entries()).map(([name, v]) => ({ name, ...v })),
    bySize: Array.from(sizeMap.entries()).map(([name, v]) => ({ name, ...v })),
  };
}

/** K3: liability by sum 3–18 (approx from SUM / BIG / SMALL / ODD / EVEN bets) */
export function analyzeK3Bets(bets: LiveBet[]) {
  const sumLiab = Array.from({ length: 19 }, () => 0);
  let totalStake = 0;
  for (const b of bets) {
    if (!isOpen(b)) continue;
    const amt = Number(b.betAmount ?? 0);
    if (!amt) continue;
    totalStake += amt;
    const type = String(b.betType ?? "").toUpperCase();
    const choice = String(b.betChoice ?? "").toUpperCase();
    for (let s = 3; s <= 18; s++) {
      let hit = false;
      if (type === "SUM" || /^\d+$/.test(choice)) {
        hit = Number(choice) === s;
      } else if (choice === "BIG" || type === "BIG") hit = s >= 11;
      else if (choice === "SMALL" || type === "SMALL") hit = s <= 10;
      else if (choice === "ODD" || type === "ODD") hit = s % 2 === 1;
      else if (choice === "EVEN" || type === "EVEN") hit = s % 2 === 0;
      if (hit) sumLiab[s] = (sumLiab[s] ?? 0) + amt;
    }
  }
  let safest = 3;
  for (let s = 4; s <= 18; s++) {
    if ((sumLiab[s] ?? 0) < (sumLiab[safest] ?? 0)) safest = s;
  }
  return { sumLiab, totalStake, safest };
}

export function secondsUntil(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((t - Date.now()) / 1000));
}

export function formatCd(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export const BALL_SRC: Record<number, string> = {
  0: "/assets/png/ball_0-053d2b99.webp",
  1: "/assets/png/ball_1-6bd610b3.webp",
  2: "/assets/png/ball_2-b101eb0b.webp",
  3: "/assets/png/ball_3-4f525185.webp",
  4: "/assets/png/ball_4-93baf748.webp",
  5: "/assets/png/ball_5-726eaa52.webp",
  6: "/assets/png/ball_6-56155f8b.webp",
  7: "/assets/png/ball_7-a1b324d5.webp",
  8: "/assets/png/ball_8-ea96e5f4.webp",
  9: "/assets/png/ball_9-9160f2ef.webp",
};

export const DICE_SRC: Record<number, string> = {
  1: "/assets/png/dice_1-3eb8e22b.png",
  2: "/assets/png/dice_2-38383685.png",
  3: "/assets/png/dice_3-c91e0c1c.png",
  4: "/assets/png/dice_4-3537b074.png",
  5: "/assets/png/dice_5-a11110ab.png",
  6: "/assets/png/dice_6-3734f323.png",
};

export const NUM_COLOR: Record<number, string> = {
  0: "linear-gradient(135deg,#9B48DB 50%,#DA3735 50%)",
  1: "#17B15E",
  2: "#DA3735",
  3: "#17B15E",
  4: "#DA3735",
  5: "linear-gradient(135deg,#17B15E 50%,#9B48DB 50%)",
  6: "#DA3735",
  7: "#17B15E",
  8: "#DA3735",
  9: "#17B15E",
};
