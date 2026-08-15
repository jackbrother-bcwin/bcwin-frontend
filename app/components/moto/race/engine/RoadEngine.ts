import type { Application, Container, Graphics } from "pixi.js";
import type * as PIXI from "pixi.js";

/**
 * More realistic road: asphalt body, dashed lanes, shoulder, city horizon,
 * finish checkered. Scroll intensity tied to race phase (calm when idle).
 */
export class RoadEngine {
  readonly layer: Container;
  private bg: Graphics;
  private asphalt: Graphics;
  private shoulderL: Graphics;
  private shoulderR: Graphics;
  private dashes: Graphics[] = [];
  private edgeL: Graphics;
  private edgeR: Graphics;
  private horizon: Graphics;
  private buildings: Graphics;
  private fog: Graphics;
  private finish: Graphics;
  private streakLayer: Container;
  private streaks: Graphics[] = [];
  private w: number;
  private h: number;
  private pixi: typeof PIXI;

  constructor(app: Application, pixi: typeof PIXI) {
    this.pixi = pixi;
    this.w = app.screen.width;
    this.h = app.screen.height;
    this.layer = new pixi.Container();
    this.layer.sortableChildren = true;

    this.bg = new pixi.Graphics();
    this.horizon = new pixi.Graphics();
    this.buildings = new pixi.Graphics();
    this.fog = new pixi.Graphics();
    this.asphalt = new pixi.Graphics();
    this.shoulderL = new pixi.Graphics();
    this.shoulderR = new pixi.Graphics();
    this.edgeL = new pixi.Graphics();
    this.edgeR = new pixi.Graphics();
    this.finish = new pixi.Graphics();
    this.streakLayer = new pixi.Container();

    this.layer.addChild(
      this.bg,
      this.horizon,
      this.buildings,
      this.fog,
      this.asphalt,
      this.shoulderL,
      this.shoulderR,
      this.edgeL,
      this.edgeR,
      this.streakLayer,
      this.finish
    );

    this.redrawStatic();
    this.buildDashes();
    this.buildStreaks();
    this.drawFinish();
  }

  private redrawStatic() {
    const w = this.w;
    const h = this.h;
    const roadTop = h * 0.16;
    const roadBot = h;

    // Night sky
    this.bg.clear();
    this.bg.rect(0, 0, w, h).fill({ color: 0x0a0810 });
    this.bg.rect(0, 0, w, roadTop + 8).fill({ color: 0x12101c });
    // Horizon purple haze
    this.bg
      .ellipse(w * 0.5, roadTop, w * 0.55, 22)
      .fill({ color: 0x4a2080, alpha: 0.2 });
    this.bg
      .ellipse(w * 0.5, roadTop + 4, w * 0.35, 12)
      .fill({ color: 0xfed358, alpha: 0.06 });

    // Distant skyline silhouettes
    this.buildings.clear();
    let bx = 0;
    while (bx < w) {
      const bw = 12 + Math.random() * 28;
      const bh = 10 + Math.random() * 36;
      this.buildings
        .rect(bx, roadTop - bh, bw, bh)
        .fill({ color: 0x0e0c14, alpha: 0.9 });
      // window dots
      for (let wy = 4; wy < bh - 4; wy += 5) {
        for (let wx = 3; wx < bw - 3; wx += 5) {
          if (Math.random() > 0.55) {
            this.buildings
              .rect(bx + wx, roadTop - bh + wy, 2, 2)
              .fill({
                color: Math.random() > 0.5 ? 0xfed358 : 0x88aaff,
                alpha: 0.25 + Math.random() * 0.35,
              });
          }
        }
      }
      bx += bw + 4 + Math.random() * 10;
    }

    this.horizon.clear();
    this.horizon
      .rect(0, roadTop - 1, w, 2)
      .fill({ color: 0xfed358, alpha: 0.15 });

    // Fog over skyline
    this.fog.clear();
    this.fog
      .rect(0, 0, w, roadTop + 20)
      .fill({ color: 0x1a1028, alpha: 0.25 });

    // Asphalt trapezoid (simple perspective)
    this.asphalt.clear();
    this.asphalt
      .moveTo(w * 0.18, roadTop)
      .lineTo(w * 0.82, roadTop)
      .lineTo(w * 1.05, roadBot)
      .lineTo(w * -0.05, roadBot)
      .closePath()
      .fill({ color: 0x1c1a22 });
    // Darker center strip
    this.asphalt
      .moveTo(w * 0.32, roadTop + 4)
      .lineTo(w * 0.68, roadTop + 4)
      .lineTo(w * 0.78, roadBot)
      .lineTo(w * 0.22, roadBot)
      .closePath()
      .fill({ color: 0x16141c, alpha: 0.65 });
    // Subtle asphalt grain (noise blocks)
    for (let i = 0; i < 50; i++) {
      const gx = Math.random() * w;
      const gy = roadTop + Math.random() * (h - roadTop);
      this.asphalt
        .rect(gx, gy, 2 + Math.random() * 4, 1)
        .fill({ color: 0x2a2830, alpha: 0.15 });
    }

    // Shoulders
    this.shoulderL.clear();
    this.shoulderR.clear();
    this.shoulderL
      .moveTo(w * 0.12, roadTop)
      .lineTo(w * 0.18, roadTop)
      .lineTo(w * -0.02, roadBot)
      .lineTo(w * -0.08, roadBot)
      .closePath()
      .fill({ color: 0x2a2218, alpha: 0.5 });
    this.shoulderR
      .moveTo(w * 0.82, roadTop)
      .lineTo(w * 0.88, roadTop)
      .lineTo(w * 1.08, roadBot)
      .lineTo(w * 1.02, roadBot)
      .closePath()
      .fill({ color: 0x2a2218, alpha: 0.5 });

    // Neon edge lines
    this.edgeL.clear();
    this.edgeR.clear();
    this.edgeL
      .moveTo(w * 0.18, roadTop)
      .lineTo(w * -0.02, roadBot)
      .stroke({ width: 2.5, color: 0x3b8cff, alpha: 0.55 });
    this.edgeR
      .moveTo(w * 0.82, roadTop)
      .lineTo(w * 1.02, roadBot)
      .stroke({ width: 2.5, color: 0xff3b4a, alpha: 0.55 });
  }

  private buildDashes() {
    for (const d of this.dashes) d.destroy();
    this.dashes = [];
    for (let i = 0; i < 20; i++) {
      const d = new this.pixi.Graphics();
      d.roundRect(0, 0, 18, 3, 1).fill({ color: 0xf0e6c8, alpha: 0.35 });
      d.x = i * 40;
      d.y = this.h * 0.55;
      this.layer.addChild(d);
      this.dashes.push(d);
    }
  }

  private buildStreaks() {
    this.streakLayer.removeChildren();
    this.streaks = [];
    for (let i = 0; i < 10; i++) {
      const s = new this.pixi.Graphics();
      s.rect(0, 0, 50, 1.2).fill({ color: 0xffffff, alpha: 0.1 });
      s.visible = false;
      this.streakLayer.addChild(s);
      this.streaks.push(s);
    }
  }

  private drawFinish() {
    this.finish.clear();
    const cell = 7;
    const cols = 3;
    const rows = Math.ceil(this.h / cell) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = (r + c) % 2 === 0;
        this.finish
          .rect(c * cell, r * cell, cell, cell)
          .fill({
            color: on ? 0xffffff : 0x111111,
            alpha: on ? 0.92 : 0.55,
          });
      }
    }
    this.finish.rect(-3, 0, 3, this.h).fill({ color: 0xfed358, alpha: 0.95 });
    this.finish.x = this.w * 0.8;
    this.finish.alpha = 0.25;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.redrawStatic();
    this.buildDashes();
    this.buildStreaks();
    this.drawFinish();
  }

  setFinishVisible(strong: boolean) {
    this.finish.alpha = strong ? 1 : 0.25;
    this.finish.x = this.w * 0.8;
  }

  get finishX() {
    return this.finish.x;
  }

  update(dt: number, t: number, speedFeel: number, racing: boolean) {
    // Idle = almost still road; race = fast scroll
    const spd = racing ? 80 + speedFeel * 420 : 8 + speedFeel * 20;

    for (const d of this.dashes) {
      d.x -= spd * dt * 0.5;
      if (d.x < -30) d.x += this.w + 50;
      d.alpha = racing ? 0.25 + speedFeel * 0.4 : 0.12;
      d.y = this.h * (0.48 + Math.sin(t + d.x * 0.01) * 0.01);
    }

    // Edge pulse only when racing
    const pulse = racing
      ? 0.5 + Math.sin(t * 7) * 0.2 + speedFeel * 0.2
      : 0.35;
    this.edgeL.alpha = pulse;
    this.edgeR.alpha = pulse;

    this.fog.alpha = 0.2 + Math.sin(t * 0.4) * 0.05;
    this.buildings.x = Math.sin(t * 0.15) * 3; // slow parallax

    // Speed streaks only while racing hard
    for (const s of this.streaks) {
      const show = racing && speedFeel > 0.35;
      s.visible = show;
      if (!show) continue;
      s.x -= (180 + speedFeel * 480) * dt;
      s.alpha = 0.05 + speedFeel * 0.18;
      if (s.x < -60) {
        s.x = this.w + Math.random() * 30;
        s.y = this.h * 0.2 + Math.random() * this.h * 0.7;
      }
    }

    if (racing) {
      this.finish.alpha =
        0.7 + Math.sin(t * 6) * 0.1 + speedFeel * 0.15;
    }
  }

  destroy() {
    this.layer.destroy({ children: true });
  }
}
