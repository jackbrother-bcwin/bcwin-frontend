/**
 * Shared countdown SFX for all lottery games (WinGo / TRX / K3 / 5D / Moto).
 * - popupaudio: plays each second for 5…1 (warning)
 * - popupatzeroaudio: plays once at 0
 * Mute persists in localStorage and is respected by all play calls.
 */

const WARN_SRC = "/assets/audio/popupaudio.mp3";
const ZERO_SRC = "/assets/audio/popupatzeroaudio.mp3";
const MUTE_KEY = "bcwin_game_sfx_muted";

let warnAudio: HTMLAudioElement | null = null;
let zeroAudio: HTMLAudioElement | null = null;
let lastPlayedSec: number | null = null;
let muted = false;
const muteListeners = new Set<(m: boolean) => void>();

function readStoredMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Call once on client (e.g. first toggle/play). */
export function initCountdownAudioMute() {
  muted = readStoredMute();
  return muted;
}

export function isCountdownMuted(): boolean {
  return muted;
}

export function setCountdownMuted(next: boolean) {
  muted = next;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    }
  } catch {
    /* ignore quota */
  }
  // Stop any in-flight clips when muting
  if (next) {
    try {
      warnAudio?.pause();
      zeroAudio?.pause();
    } catch {
      /* ignore */
    }
  }
  muteListeners.forEach((fn) => fn(muted));
}

export function toggleCountdownMuted(): boolean {
  setCountdownMuted(!muted);
  return muted;
}

/** Subscribe to mute changes (for UI toggle). Returns unsubscribe. */
export function subscribeCountdownMute(fn: (m: boolean) => void): () => void {
  muteListeners.add(fn);
  return () => {
    muteListeners.delete(fn);
  };
}

function getWarn(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!warnAudio) {
    warnAudio = new Audio(WARN_SRC);
    warnAudio.preload = "auto";
    warnAudio.volume = 0.85;
  }
  return warnAudio;
}

function getZero(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!zeroAudio) {
    zeroAudio = new Audio(ZERO_SRC);
    zeroAudio.preload = "auto";
    zeroAudio.volume = 0.9;
  }
  return zeroAudio;
}

function safePlay(el: HTMLAudioElement | null) {
  if (!el || muted) return;
  try {
    el.pause();
    el.currentTime = 0;
    void el.play().catch(() => {
      /* autoplay blocked until user gesture — ignore */
    });
  } catch {
    /* ignore */
  }
}

/**
 * Call whenever the game countdown integer changes.
 * Plays warning for 5–1, zero sting at 0. Idempotent per second value.
 */
export function playCountdownBeep(seconds: number) {
  const s = Math.floor(seconds);
  if (s < 0 || s > 5) {
    if (s > 5) lastPlayedSec = null;
    return;
  }
  if (lastPlayedSec === s) return;
  lastPlayedSec = s;

  if (muted) return;

  if (s === 0) {
    safePlay(getZero());
    return;
  }
  safePlay(getWarn());
}

export function preloadCountdownAudio() {
  if (typeof window === "undefined") return;
  muted = readStoredMute();
  getWarn()?.load();
  getZero()?.load();
}

export function resetCountdownAudio() {
  lastPlayedSec = null;
}
