import type { Container } from "pixi.js";
import { damp } from "./easing";

/**
 * Virtual camera — subtle float/zoom/shake.
 * Never pans the world sideways in a way that makes the finish line
 * "come toward" the bikes (that reads as the line moving, not the bikes).
 */
export class CameraEngine {
  private world: Container;
  private w = 320;
  private h = 200;
  x = 0;
  y = 0;
  zoom = 1;
  private targetZoom = 1;
  private shake = 0;
  private shakeDecay = 5;
  private punch = 0;
  /** When true, only micro float — no speed pan */
  private locked = false;

  constructor(world: Container) {
    this.world = world;
  }

  setViewport(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  setZoom(z: number) {
    this.targetZoom = z;
  }

  /** Lock pan so finish line stays planted in world space */
  setLocked(locked: boolean) {
    this.locked = locked;
  }

  addShake(amount: number) {
    this.shake = Math.min(2.2, this.shake + amount);
  }

  addPunch(amount = 0.035) {
    this.punch = Math.max(this.punch, amount);
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.shake = 0;
    this.punch = 0;
    this.locked = false;
    this.apply();
  }

  update(dt: number, t: number, speedFeel: number) {
    // Very subtle handheld only — no lateral "follow" that slides the finish line
    const floatAmp = this.locked ? 0.4 : 1.2;
    const floatX = Math.sin(t * 0.65) * floatAmp * 0.8;
    const floatY =
      Math.cos(t * 0.5) * floatAmp * 0.9 +
      (this.locked ? 0 : speedFeel * 0.35);

    this.x = damp(this.x, floatX, 4, dt);
    this.y = damp(this.y, floatY, 4, dt);
    this.zoom = damp(this.zoom, this.targetZoom + this.punch, 6, dt);
    this.punch = damp(this.punch, 0, 9, dt);

    this.shake = Math.max(0, this.shake - this.shakeDecay * dt);
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 4 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 4 : 0;

    this.apply(sx, sy);
  }

  private apply(sx = 0, sy = 0) {
    // Zoom from screen center so right-side finish line doesn't slide inward
    const z = this.zoom;
    this.world.pivot.set(this.w / 2, this.h / 2);
    this.world.position.set(
      this.w / 2 + this.x + sx,
      this.h / 2 + this.y + sy
    );
    this.world.scale.set(z);
  }
}
