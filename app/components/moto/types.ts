/**
 * Moto Racing — shared types
 */

/** Result of a resolved race period: podium positions (bike numbers 1–10) */
export interface PodiumResult {
  firstPlace: number;
  secondPlace: number;
  thirdPlace: number;
  periodNumber?: string;
  periodId?: string;
}

/**
 * Imperative handle on RaceCanvas.
 *
 * Flow:
 *   setIdle() → lineup
 *   startRacing() → high-speed pack run (after bet lock ~7s left)
 *   finishWithPodium(result) → ordered finish + top-3 celebration (at 00)
 */
export interface RaceCanvasHandle {
  /** Begin continuous high-speed race (no result yet). */
  startRacing(): void;
  /** Finish in API order: 1st crosses first, then 2nd, 3rd; show podium. */
  finishWithPodium(podium: PodiumResult): Promise<boolean>;
  /** Full race from standstill if result already known (fallback). */
  playRace(podium: PodiumResult): Promise<boolean>;
  setIdle(): void;
  isReady(): boolean;
  /** Current scene phase */
  getPhase(): "idle" | "countdown" | "racing" | "finishing" | "podium";
}
