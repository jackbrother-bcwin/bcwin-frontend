import type { Application, Container, Graphics, Text } from "pixi.js";
import type * as PIXI from "pixi.js";
import { damp, backOut, expoOut, clamp01 } from "./easing";

/**
 * Screen FX: vignette, flash, countdown digits, bloom wash, noise, speed grade.
 */
export class EffectsEngine {
  readonly layer: Container;
  private vignette: Graphics;
  private flash: Graphics;
  private wash: Graphics;
  private noise: Graphics;
  private cdText: Text;
  private pixi: typeof PIXI;
  private w: number;
  private h: number;

  flashAlpha = 0;
  washAlpha = 0;
  private cdPhase = -1; // -1 hidden
  private cdLabel = "";
  private cdT = 0;
  private cdScale = 1;
  private cdAlpha = 0;

  constructor(app: Application, pixi: typeof PIXI) {
    this.pixi = pixi;
    this.w = app.screen.width;
    this.h = app.screen.height;
    this.layer = new pixi.Container();
    this.layer.zIndex = 100;
    this.layer.eventMode = "none";

    this.wash = new pixi.Graphics();
    this.vignette = new pixi.Graphics();
    this.flash = new pixi.Graphics();
    this.noise = new pixi.Graphics();
    this.drawStatic();

    this.layer.addChild(this.wash, this.vignette, this.noise, this.flash);

    this.cdText = new pixi.Text({
      text: "",
      style: {
        fontSize: 66,
        fontWeight: "900",
        fill: 0xfed358,
        fontFamily: "system-ui, sans-serif",
        align: "center",
      },
    });
    this.cdText.anchor.set(0.5);
    this.cdText.visible = false;
    this.layer.addChild(this.cdText);
  }

  private drawStatic() {
    this.wash.clear();
    this.wash.rect(0, 0, this.w, this.h).fill({ color: 0xfed358, alpha: 1 });
    this.wash.alpha = 0;

    this.flash.clear();
    this.flash.rect(0, 0, this.w, this.h).fill({ color: 0xffffff, alpha: 1 });
    this.flash.alpha = 0;

    this.vignette.clear();
    // Soft edge darkening via layered rects
    this.vignette.rect(0, 0, this.w, this.h * 0.12).fill({
      color: 0x000000,
      alpha: 0.35,
    });
    this.vignette.rect(0, this.h * 0.88, this.w, this.h * 0.12).fill({
      color: 0x000000,
      alpha: 0.4,
    });
    this.vignette.rect(0, 0, this.w * 0.06, this.h).fill({
      color: 0x000000,
      alpha: 0.25,
    });
    this.vignette.rect(this.w * 0.94, 0, this.w * 0.06, this.h).fill({
      color: 0x000000,
      alpha: 0.25,
    });
    this.vignette.alpha = 0.7;

    this.noise.clear();
    for (let i = 0; i < 40; i++) {
      this.noise
        .rect(
          Math.random() * this.w,
          Math.random() * this.h,
          1 + Math.random() * 2,
          1
        )
        .fill({ color: 0xffffff, alpha: 0.03 });
    }
    this.noise.alpha = 0.35;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.drawStatic();
    this.cdText.position.set(w / 2, h / 2);
  }

  /** White screen flash */
  triggerFlash(strength = 0.35) {
    this.flashAlpha = Math.max(this.flashAlpha, strength);
  }

  /** Gold grade wash */
  triggerWash(strength = 0.12) {
    this.washAlpha = Math.max(this.washAlpha, strength);
  }

  /**
   * Play cinematic countdown sequence.
   * Returns promise when GO finishes.
   */
  async playCountdown(
    onDigit?: (label: string) => void
  ): Promise<void> {
    const labels = ["3", "2", "1", "GO!"];
    for (const label of labels) {
      this.cdLabel = label;
      this.cdPhase = 0;
      this.cdT = 0;
      this.cdScale = 0.25;
      this.cdAlpha = 0;
      this.cdText.text = label;
      this.cdText.visible = true;
      this.cdText.style.fill = label === "GO!" ? 0x17e68a : 0xfed358;
      onDigit?.(label);
      this.triggerFlash(label === "GO!" ? 0.28 : 0.14);
      this.triggerWash(0.08);
      await this.wait(0.72);
    }
    this.cdText.visible = false;
    this.cdPhase = -1;
  }

  private wait(sec: number) {
    return new Promise<void>((r) => setTimeout(r, sec * 1000));
  }

  update(dt: number) {
    this.flashAlpha = damp(this.flashAlpha, 0, 10, dt);
    this.washAlpha = damp(this.washAlpha, 0, 6, dt);
    this.flash.alpha = this.flashAlpha;
    this.wash.alpha = this.washAlpha;

    // Noise crawl
    this.noise.alpha = 0.25 + Math.random() * 0.12;
    if (Math.random() < 0.08) {
      this.noise.y = (Math.random() - 0.5) * 4;
    }

    if (this.cdPhase >= 0) {
      this.cdT += dt;
      const u = clamp01(this.cdT / 0.55);
      // Scale up with back-out bounce
      this.cdScale = 0.3 + backOut(Math.min(1, u * 1.2)) * 0.95;
      this.cdAlpha =
        u < 0.7 ? expoOut(u / 0.7) : 1 - clamp01((u - 0.7) / 0.3);
      this.cdText.scale.set(this.cdScale);
      this.cdText.alpha = this.cdAlpha;
      this.cdText.position.set(this.w / 2, this.h * 0.42);
    }
  }

  destroy() {
    this.layer.destroy({ children: true });
  }
}
