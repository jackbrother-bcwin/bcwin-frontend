/** Premium game easings (no linear) */

export function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function smoothstep(t: number) {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function smootherstep(t: number) {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Expo.Out */
export function expoOut(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Power4.Out */
export function power4Out(t: number) {
  const x = 1 - clamp01(t);
  return 1 - x * x * x * x;
}

/** Power3.In — acceleration / launch */
export function power3In(t: number) {
  const x = clamp01(t);
  return x * x * x;
}

/** Power2.InOut */
export function power2InOut(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Back.Out (overshoot) */
export function backOut(t: number, s = 1.70158) {
  const x = clamp01(t) - 1;
  return 1 + x * x * ((s + 1) * x + s);
}

/** Elastic.Out (settle) */
export function elasticOut(t: number) {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  return (
    Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  );
}

/** Critically-damped spring toward target */
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number
) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
