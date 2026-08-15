/**
 * Game-specific result chips for win/loss ResultPopup.
 * Only include attributes that exist for that game — never WinGo color/size for K3/5D/Moto.
 */

export type ResultChip = {
  text: string;
  /** CSS background; omit for neutral dark chip */
  bg?: string;
};

const NEUTRAL = "rgba(0,0,0,0.4)";
const SIZE_BIG = "linear-gradient(180deg,#FFB472,#DD9138)";
const SIZE_SMALL = "linear-gradient(180deg,#6ba3e8,#5088D3)";
const ODD = "#17B15E";
const EVEN = "#DA3735";
const SUM = "#CF7C10";

/** WinGo / TRX: color · digit (0–9 with dual 0/5) · size */
export function wingoResultChips(opts: {
  resultNumber?: number | null;
  resultColor?: string | null;
  resultSize?: string | null;
}): ResultChip[] {
  const chips: ResultChip[] = [];
  const n = opts.resultNumber;

  // Color (WinGo only)
  if (n === 0) chips.push({ text: "Red Violet", bg: "#DA3735" });
  else if (n === 5) chips.push({ text: "Green Violet", bg: "#17B15E" });
  else {
    const c = (opts.resultColor ?? "").toUpperCase();
    if (c.includes("GREEN") && c.includes("VIOLET"))
      chips.push({ text: "Green Violet", bg: "#17B15E" });
    else if (c.includes("RED") && c.includes("VIOLET"))
      chips.push({ text: "Red Violet", bg: "#DA3735" });
    else if (c.includes("GREEN")) chips.push({ text: "Green", bg: "#17B15E" });
    else if (c.includes("RED")) chips.push({ text: "Red", bg: "#DA3735" });
    else if (c.includes("VIOLET") || c.includes("PURPLE"))
      chips.push({ text: "Violet", bg: "#9B48DB" });
    else if (n != null && n >= 0 && n <= 9) {
      chips.push({
        text: n % 2 === 0 ? "Red" : "Green",
        bg: n % 2 === 0 ? "#DA3735" : "#17B15E",
      });
    }
  }

  // Digit ball style
  if (n != null && n >= 0 && n <= 9) {
    let bg = n % 2 === 0 ? "#DA3735" : "#17B15E";
    if (n === 0) bg = "linear-gradient(135deg,#9B48DB 50%,#DA3735 50%)";
    if (n === 5) bg = "linear-gradient(135deg,#9B48DB 50%,#17B15E 50%)";
    chips.push({ text: String(n), bg });
  }

  // Size Big/Small (0–4 small, 5–9 big)
  const s = (opts.resultSize ?? "").toUpperCase();
  if (s.includes("BIG")) chips.push({ text: "Big", bg: SIZE_BIG });
  else if (s.includes("SMALL")) chips.push({ text: "Small", bg: SIZE_SMALL });
  else if (n != null && n >= 0 && n <= 9) {
    chips.push({
      text: n >= 5 ? "Big" : "Small",
      bg: n >= 5 ? SIZE_BIG : SIZE_SMALL,
    });
  }

  return chips;
}

/**
 * K3: same shape as game history —
 * dice result (d1-d2-d3) · sum · Big/Small · Odd/Even
 */
export function k3ResultChips(r: {
  dice1: number;
  dice2: number;
  dice3: number;
  sum: number;
  isBig?: boolean | null;
  isSmall?: boolean | null;
  isOdd?: boolean | null;
  isEven?: boolean | null;
}): ResultChip[] {
  const chips: ResultChip[] = [];
  // History-style dice result
  chips.push({
    text: `${r.dice1}-${r.dice2}-${r.dice3}`,
    bg: "linear-gradient(180deg,#5B4A3A,#2A2218)",
  });
  chips.push({ text: `Σ${r.sum}`, bg: SUM });

  const isBig =
    r.isBig === true || (r.isBig == null && r.isSmall !== true && r.sum >= 11);
  const isSmall =
    r.isSmall === true || (r.isSmall == null && r.isBig !== true && r.sum <= 10);
  if (isBig) chips.push({ text: "Big", bg: SIZE_BIG });
  else if (isSmall) chips.push({ text: "Small", bg: SIZE_SMALL });

  const isOdd = r.isOdd === true || (r.isOdd == null && r.sum % 2 === 1);
  const isEven = r.isEven === true || (r.isEven == null && r.sum % 2 === 0);
  if (isOdd) chips.push({ text: "Odd", bg: ODD });
  else if (isEven) chips.push({ text: "Even", bg: EVEN });

  return chips;
}

/**
 * 5D popup: sum · Low/High · Odd/Even only
 * (no A–E digit chips)
 */
export function fiveDResultChips(r: {
  resultDigitA?: number;
  resultDigitB?: number;
  resultDigitC?: number;
  resultDigitD?: number;
  resultDigitE?: number;
  resultSum: number;
}): ResultChip[] {
  const chips: ResultChip[] = [];
  chips.push({ text: `Σ${r.resultSum}`, bg: SUM });
  // 5D sum: LOW 0–22, HIGH 23–45 (matches backend)
  if (r.resultSum >= 23) chips.push({ text: "High", bg: SIZE_BIG });
  else chips.push({ text: "Low", bg: SIZE_SMALL });
  if (r.resultSum % 2 === 1) chips.push({ text: "Odd", bg: ODD });
  else chips.push({ text: "Even", bg: EVEN });
  return chips;
}

/** Moto: podium places with bike numbers (and optional bike color) */
export function motoResultChips(r: {
  firstPlace?: number | null;
  secondPlace?: number | null;
  thirdPlace?: number | null;
  bikeBg?: (n: number) => string;
}): ResultChip[] {
  const chips: ResultChip[] = [];
  const bg = (n: number) => r.bikeBg?.(n) ?? NEUTRAL;
  if (r.firstPlace != null)
    chips.push({ text: `1st #${r.firstPlace}`, bg: bg(r.firstPlace) });
  if (r.secondPlace != null)
    chips.push({ text: `2nd #${r.secondPlace}`, bg: bg(r.secondPlace) });
  if (r.thirdPlace != null)
    chips.push({ text: `3rd #${r.thirdPlace}`, bg: bg(r.thirdPlace) });

  // Optional first-place side attributes used by moto bet types
  if (r.firstPlace != null) {
    const n = r.firstPlace;
    chips.push({
      text: n % 2 === 1 ? "Odd" : "Even",
      bg: n % 2 === 1 ? ODD : EVEN,
    });
    // Moto big/small typically 6–10 big, 1–5 small
    chips.push({
      text: n >= 6 ? "Big" : "Small",
      bg: n >= 6 ? SIZE_BIG : SIZE_SMALL,
    });
  }
  return chips;
}

export const RESULT_HEADINGS = {
  wingo: "Lottery results",
  k3: "Dice result",
  fived: "5D result",
  moto: "Race result",
} as const;
