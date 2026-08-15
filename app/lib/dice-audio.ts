/**
 * Dice roll / land SFX (Web Audio — no extra asset files).
 * Respects the same mute key as countdown audio.
 */

import { isCountdownMuted, initCountdownAudioMute } from "./countdown-audio";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  initCountdownAudioMute();
  if (isCountdownMuted()) return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Short noise burst — used while dice tumble (cheap + throttled by callers). */
export function playDiceRattle(intensity = 0.5) {
  const ac = getCtx();
  if (!ac) return;
  // Short osc burst instead of allocating a full AudioBuffer every hit
  // (buffer churn was freezing the countdown near 0 on weaker devices).
  const t0 = ac.currentTime;
  const dur = 0.03 + Math.random() * 0.025;
  const osc = ac.createOscillator();
  osc.type = "square";
  osc.frequency.value = 600 + Math.random() * 900;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900 + Math.random() * 1100;
  filter.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.1 * intensity, t0 + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.01);
}

/** Thump when dice land (layered for tray impact) */
export function playDiceLand() {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime;

  // Low thump
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.14);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.38, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + 0.24);

  // Wood/table click
  const click = ac.createOscillator();
  click.type = "triangle";
  click.frequency.value = 420;
  const cg = ac.createGain();
  cg.gain.setValueAtTime(0.14, t0);
  cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
  click.connect(cg);
  cg.connect(ac.destination);
  click.start(t0);
  click.stop(t0 + 0.08);

  // Soft secondary bounce thumps
  for (const [delay, freq, vol] of [
    [0.05, 140, 0.12],
    [0.11, 110, 0.08],
  ] as const) {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, t0 + delay);
    o.frequency.exponentialRampToValueAtTime(40, t0 + delay + 0.1);
    const gg = ac.createGain();
    gg.gain.setValueAtTime(0.0001, t0 + delay);
    gg.gain.exponentialRampToValueAtTime(vol, t0 + delay + 0.008);
    gg.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.12);
    o.connect(gg);
    gg.connect(ac.destination);
    o.start(t0 + delay);
    o.stop(t0 + delay + 0.14);
  }
}

/** Soft tick for face flicker */
export function playDiceTick() {
  playDiceRattle(0.35);
}
