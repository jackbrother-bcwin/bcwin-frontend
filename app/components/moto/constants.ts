/**
 * Moto Racing — constants & helpers
 *
 * Timeline (e.g. 30s period):
 *   open betting → lock @ 5s left (30s) / 10s left (longer)
 *   → 3-2-1-GO → race → podium → new period
 */

export type MotoTabId = "30s" | "1min" | "3min" | "5min";

export const MOTO_TABS = [
  { id: "30s" as const, label: "Moto", subLabel: "30s", seconds: 30 },
  { id: "1min" as const, label: "Moto", subLabel: "1min", seconds: 60 },
  { id: "3min" as const, label: "Moto", subLabel: "3min", seconds: 180 },
  { id: "5min" as const, label: "Moto", subLabel: "5min", seconds: 300 },
];

export type TargetPos = "FIRST" | "SECOND" | "THIRD";

/**
 * Stop betting this many seconds before period end.
 * 30s → 5s · 1/3/5 min → 10s
 */
export function motoBetLockSeconds(durationSeconds: number): number {
  return durationSeconds <= 30 ? 5 : 10;
}

/** @deprecated use motoBetLockSeconds(duration) — kept for static 10s references in race UI */
export const MOTO_BET_LOCK_SECONDS = 10;

/**
 * After GO, race runs until about this many seconds left,
 * then final stretch / podium (when result is ready).
 */
export const MOTO_RACE_END_SECONDS = 2;

export function isMotoBettingLocked(
  countdown: number,
  durationSeconds = 60
): boolean {
  return countdown <= motoBetLockSeconds(durationSeconds);
}

export interface BikeColorConfig {
  primary: string;
  glow: string;
  name: string;
}

const BIKE_COLORS: Record<number, BikeColorConfig> = {
  1: { primary: "#DA3735", glow: "#FF6B6B", name: "Red" },
  2: { primary: "#3B82F6", glow: "#60A5FA", name: "Blue" },
  3: { primary: "#8B5CF6", glow: "#A78BFA", name: "Purple" },
  4: { primary: "#06B6D4", glow: "#22D3EE", name: "Cyan" },
  5: { primary: "#22C55E", glow: "#4ADE80", name: "Green" },
  6: { primary: "#9333EA", glow: "#C084FC", name: "Violet" },
  7: { primary: "#6366F1", glow: "#818CF8", name: "Indigo" },
  8: { primary: "#F97316", glow: "#FB923C", name: "Orange" },
  9: { primary: "#EF4444", glow: "#F87171", name: "Coral" },
  10: { primary: "#F59E0B", glow: "#FBBF24", name: "Amber" },
};

export function bikeColor(n: number): BikeColorConfig {
  return (
    BIKE_COLORS[n] ?? { primary: "#6B7280", glow: "#9CA3AF", name: "Gray" }
  );
}

export const BIKE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const ALL_BIKE_COLORS = BIKE_NUMBERS.map((n) => ({
  number: n,
  ...bikeColor(n),
}));
