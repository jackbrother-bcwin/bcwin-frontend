import type { Application, Container, Graphics, Text } from "pixi.js";
import type * as PIXI from "pixi.js";
import { bikeColor, BIKE_NUMBERS } from "../../constants";
import { damp, lerp } from "./easing";
import type { BikeRuntime, RacePhase } from "./types";
import type { ParticleEngine } from "./ParticleEngine";

/**
 * Side-view motorcycles (not cars) — tank, seat, forks, two wheels, rider.
 */
export class BikeEngine {
  readonly layer: Container;
  bikes: BikeRuntime[] = [];
  private pixi: typeof PIXI;
  private h: number;
  private w: number;

  constructor(app: Application, pixi: typeof PIXI) {
    this.pixi = pixi;
    this.w = app.screen.width;
    this.h = app.screen.height;
    this.layer = new pixi.Container();
    this.layer.sortableChildren = true;
    this.layer.zIndex = 20;
    this.buildBikes();
  }

  private buildBikes() {
    const nLanes = 10;
    const laneH = this.h / (nLanes + 1);

    for (let i = 0; i < nLanes; i++) {
      const num = BIKE_NUMBERS[i]!;
      const col = bikeColor(num);
      const primary = parseInt(col.primary.slice(1), 16);
      const glowC = parseInt(col.glow.slice(1), 16);
      const dark = this.shade(primary, 0.55);
      const baseY = (i + 1) * laneH;

      const root = new this.pixi.Container();
      root.y = baseY;
      root.x = 30;
      root.zIndex = i;

      // Ground shadow (oval under bike)
      const shadow = new this.pixi.Graphics();
      shadow.ellipse(22, 14, 28, 4.5).fill({ color: 0x000000, alpha: 0.42 });
      root.addChild(shadow);

      const glow = new this.pixi.Graphics();
      glow.ellipse(22, 0, 30, 8).fill({ color: glowC, alpha: 0.12 });
      root.addChild(glow);

      const body = new this.pixi.Container();
      root.addChild(body);

      // Exhaust puff anchor (rear)
      const exhaust = new this.pixi.Graphics();
      exhaust.circle(-6, 4, 2.5).fill({ color: 0x777788, alpha: 0.35 });
      body.addChild(exhaust);

      // --- Motorcycle silhouette (side view, facing right) ---
      const chassis = new this.pixi.Graphics();

      // Rear wheel
      this.drawMotoWheel(chassis, 8, 8, 7.5);
      // Front wheel
      this.drawMotoWheel(chassis, 40, 8, 7.2);

      // Swingarm
      chassis
        .moveTo(14, 6)
        .lineTo(22, 2)
        .stroke({ width: 2, color: 0x2a2a30 });

      // Front fork
      chassis
        .moveTo(36, -2)
        .lineTo(40, 8)
        .stroke({ width: 2.2, color: 0x33333a });
      chassis
        .moveTo(38, -2)
        .lineTo(42, 8)
        .stroke({ width: 1.4, color: 0x55555e });

      // Frame spar
      chassis
        .moveTo(14, 4)
        .lineTo(28, -2)
        .lineTo(36, -2)
        .stroke({ width: 2.4, color: 0x1a1a20 });

      // Fuel tank (teardrop — key motorcycle shape)
      chassis
        .moveTo(16, 0)
        .bezierCurveTo(18, -12, 30, -13, 34, -4)
        .bezierCurveTo(32, 2, 20, 4, 16, 0)
        .fill({ color: primary });
      // Tank highlight
      chassis
        .moveTo(20, -8)
        .bezierCurveTo(24, -11, 28, -10, 30, -6)
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.22 });

      // Seat
      chassis
        .roundRect(12, -6, 12, 4, 2)
        .fill({ color: 0x1a1218 });
      chassis
        .ellipse(14, -4, 4, 3)
        .fill({ color: 0x221820 });

      // Tail section
      chassis
        .moveTo(10, -2)
        .lineTo(4, -6)
        .lineTo(6, 2)
        .lineTo(12, 2)
        .closePath()
        .fill({ color: dark });

      // Engine block
      chassis
        .roundRect(20, 0, 12, 8, 1.5)
        .fill({ color: 0x2c2c34 });
      chassis
        .rect(22, 2, 3, 5)
        .fill({ color: 0x444450 });

      // Front fender
      chassis
        .arc(40, 8, 9, Math.PI * 1.1, Math.PI * 1.9, false)
        .stroke({ width: 2.2, color: primary });

      // Rear fender
      chassis
        .arc(8, 8, 9, Math.PI * 1.15, Math.PI * 1.85, false)
        .stroke({ width: 2, color: dark });

      // Handlebars
      chassis
        .moveTo(34, -6)
        .lineTo(32, -12)
        .lineTo(38, -11)
        .stroke({ width: 1.6, color: 0x222228 });

      // Rider (simple helmet + torso — sells "moto" not car)
      chassis.circle(28, -16, 4.2).fill({ color: 0xfed358 });
      chassis.circle(28, -16, 4.2).stroke({ width: 1, color: 0x1a1000, alpha: 0.35 });
      // Visor
      chassis
        .ellipse(30, -16, 2.2, 1.6)
        .fill({ color: 0x1a3040, alpha: 0.85 });
      // Torso lean
      chassis
        .moveTo(24, -12)
        .lineTo(30, -4)
        .lineTo(22, -2)
        .closePath()
        .fill({ color: 0x1e1a22 });
      // Arm to bars
      chassis
        .moveTo(28, -10)
        .lineTo(34, -7)
        .stroke({ width: 2, color: 0x2a2430 });

      // Number plate circle on tank
      chassis.circle(25, -5, 5.5).fill({ color: 0x110d14, alpha: 0.55 });
      chassis.circle(25, -5, 5.5).stroke({ width: 1, color: 0xffffff, alpha: 0.25 });

      body.addChild(chassis);

      // Separate wheel graphics for spin (overlay spokes)
      const wheelR = new this.pixi.Graphics();
      this.drawSpokes(wheelR, 7);
      wheelR.position.set(8, 8);
      body.addChild(wheelR);

      const wheelF = new this.pixi.Graphics();
      this.drawSpokes(wheelF, 7);
      wheelF.position.set(40, 8);
      body.addChild(wheelF);

      const headlight = new this.pixi.Graphics();
      headlight.circle(44, -2, 2.8).fill({ color: 0xffffee, alpha: 0.95 });
      headlight.circle(44, -2, 6).fill({ color: 0xfff8cc, alpha: 0.12 });
      body.addChild(headlight);

      const taillight = new this.pixi.Graphics();
      taillight.roundRect(2, -7, 3.5, 4, 1).fill({ color: 0xff2040, alpha: 0.85 });
      body.addChild(taillight);

      const label = new this.pixi.Text({
        text: String(num),
        style: {
          fontSize: 9,
          fontWeight: "900",
          fill: 0xffffff,
          fontFamily: "system-ui,sans-serif",
        },
      });
      label.anchor.set(0.5);
      label.position.set(25, -5);
      body.addChild(label);

      this.layer.addChild(root);

      this.bikes.push({
        number: num,
        root,
        body,
        chassis,
        wheelF,
        wheelR,
        glow,
        shadow,
        exhaust,
        headlight,
        taillight,
        label,
        baseY,
        progress: 0,
        velocity: 0,
        targetVelocity: 0,
        bounce: 0,
        bounceVel: 0,
        rock: 0,
        rockVel: 0,
        lean: 0,
        wheelSpin: 0,
        engineHz: 12 + Math.random() * 5,
        seed: Math.random() * Math.PI * 2,
        finishRank: 9,
        finishTarget: 1,
        scalePunch: 1,
        podiumX: 30,
        podiumY: baseY,
        rankBadge: null,
      });
    }
  }

  private shade(hex: number, f: number): number {
    const r = Math.floor(((hex >> 16) & 0xff) * f);
    const g = Math.floor(((hex >> 8) & 0xff) * f);
    const b = Math.floor((hex & 0xff) * f);
    return (r << 16) | (g << 8) | b;
  }

  private drawMotoWheel(g: Graphics, cx: number, cy: number, r: number) {
    g.circle(cx, cy, r).fill({ color: 0x0a0a0c });
    g.circle(cx, cy, r).stroke({ width: 2.5, color: 0x2a2a30 });
    g.circle(cx, cy, r * 0.55).fill({ color: 0x1c1c22 });
    g.circle(cx, cy, r * 0.22).fill({ color: 0x666670 });
  }

  private drawSpokes(g: Graphics, r: number) {
    g.clear();
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      g.moveTo(0, 0)
        .lineTo(Math.cos(ang) * r * 0.85, Math.sin(ang) * r * 0.85)
        .stroke({ width: 1.1, color: 0x888890, alpha: 0.7 });
    }
    g.circle(0, 0, 1.8).fill({ color: 0xaaaab0 });
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    const laneH = h / 11;
    this.bikes.forEach((b, i) => {
      b.baseY = (i + 1) * laneH;
    });
  }

  progressToX(p: number, startX: number, endX: number) {
    return startX + (endX - startX) * Math.min(1, Math.max(0, p));
  }

  resetIdle(startX: number) {
    for (const b of this.bikes) {
      b.progress = 0;
      b.velocity = 0;
      b.targetVelocity = 0;
      b.bounce = 0;
      b.bounceVel = 0;
      b.rock = 0;
      b.lean = 0;
      b.scalePunch = 1;
      b.finishRank = 9;
      b.finishTarget = 1;
      b.scalePunch = 1;
      b.podiumX = startX;
      b.podiumY = b.baseY;
      if (b.rankBadge) {
        b.rankBadge.visible = false;
      }
      b.root.scale.set(1);
      b.root.alpha = 1;
      b.root.x = startX;
      b.root.y = b.baseY;
      b.body.rotation = 0;
      b.glow.alpha = 0.1;
      b.headlight.alpha = 0.55;
    }
  }

  /**
   * Layout top-3 on a visible podium (center of track).
   * 1st highest center, 2nd left, 3rd right.
   */
  layoutPodium(w: number, h: number) {
    const cx = w * 0.5;
    const base = h * 0.55;
    // rank → position
    const slots: Record<number, { x: number; y: number; label: string; color: number }> = {
      0: { x: cx, y: base - 28, label: "1st", color: 0xfed358 },
      1: { x: cx - w * 0.18, y: base - 8, label: "2nd", color: 0xc0c8d8 },
      2: { x: cx + w * 0.18, y: base + 4, label: "3rd", color: 0xe8a060 },
    };

    for (const b of this.bikes) {
      if (b.finishRank >= 0 && b.finishRank < 3) {
        const s = slots[b.finishRank]!;
        b.podiumX = s.x;
        b.podiumY = s.y;
        if (!b.rankBadge) {
          const badge = new this.pixi.Text({
            text: s.label,
            style: {
              fontSize: 14,
              fontWeight: "900",
              fill: s.color,
              fontFamily: "system-ui,sans-serif",
            },
          });
          badge.anchor.set(0.5, 1);
          badge.y = -28;
          b.root.addChild(badge);
          b.rankBadge = badge;
        } else {
          b.rankBadge.text = s.label;
          b.rankBadge.style.fill = s.color;
          b.rankBadge.visible = true;
        }
        b.root.zIndex = 100 - b.finishRank;
      } else {
        if (b.rankBadge) b.rankBadge.visible = false;
        b.podiumX = b.root.x;
        b.podiumY = b.baseY + 40;
        b.root.zIndex = b.number;
      }
    }
    this.layer.sortChildren();
  }

  update(
    dt: number,
    t: number,
    phase: RacePhase,
    startX: number,
    endX: number,
    particles: ParticleEngine,
    finishBlend = 0
  ) {
    const racing =
      phase === "racing" || phase === "finishing" || phase === "countdown";

    for (let i = 0; i < this.bikes.length; i++) {
      const b = this.bikes[i]!;
      const seed = b.seed;

      if (phase === "idle") {
        // Calm grid — only micro idle, NO racing feel
        b.targetVelocity = 0;
        b.velocity = damp(b.velocity, 0, 10, dt);
        b.progress = 0;
      } else if (phase === "countdown") {
        // Anticipation only — almost still on grid
        b.targetVelocity = 0;
        b.velocity = damp(b.velocity, 0, 8, dt);
        b.progress = damp(b.progress, 0.02, 5, dt);
      } else if (phase === "racing") {
        const noise =
          Math.sin(t * 1.5 + seed) * 0.04 +
          Math.sin(t * 3.2 + seed * 1.4) * 0.02;
        const desired = 0.42 + noise + (i % 3) * 0.012;
        const err = desired - b.progress;
        b.targetVelocity = 0.55 + err * 1.9 + Math.sin(t * 2 + seed) * 0.07;
        b.velocity = damp(b.velocity, b.targetVelocity, 5, dt);
        b.progress += b.velocity * dt;
        if (b.progress > 0.72) {
          b.progress = 0.72 - Math.abs(Math.sin(t * 1.4 + seed)) * 0.015;
          b.velocity *= 0.88;
        }
        if (b.progress < 0.08) b.progress = 0.08;
      } else if (phase === "finishing") {
        // Bikes ride TOWARD fixed finish line (progress → 1), line does not move
        const target = b.finishTarget;
        const startP = Math.min(Math.max(b.progress, 0.15), 0.7);
        b.progress = lerp(startP, target, finishBlend);
        b.velocity =
          lerp(0.85, 0.1, finishBlend) + (b.finishRank === 0 ? 0.15 : 0);
      } else if (phase === "podium") {
        b.velocity = damp(b.velocity, 0, 5, dt);
        const targetScale =
          b.finishRank === 0 ? 1.35 : b.finishRank < 3 ? 1.15 : 0.75;
        b.scalePunch = damp(b.scalePunch, targetScale, 4, dt);
        b.root.alpha = damp(
          b.root.alpha,
          b.finishRank < 3 ? 1 : 0.2,
          3,
          dt
        );
      }

      // Secondary motion — subtle on idle, lively when racing
      const eng =
        phase === "idle"
          ? b.engineHz * 0.7
          : b.engineHz * (racing ? 2.2 : 1.4);
      const vibAmp =
        phase === "idle" ? 0.35 : phase === "countdown" ? 1.6 : 1.0;
      const vib = Math.sin(t * eng + seed) * vibAmp;

      const bounceTarget =
        Math.sin(t * eng * 0.6 + seed * 2) *
        (phase === "idle" ? 0.4 : racing ? 1.2 : 0.7);
      b.bounceVel += (bounceTarget - b.bounce) * 36 * dt;
      b.bounceVel *= Math.exp(-9 * dt);
      b.bounce += b.bounceVel * dt;

      const rockTarget =
        Math.sin(t * (phase === "idle" ? 3.5 : 6) + seed) *
        (phase === "idle" ? 0.008 : 0.016);
      b.rockVel += (rockTarget - b.rock) * 28 * dt;
      b.rockVel *= Math.exp(-10 * dt);
      b.rock += b.rockVel * dt;

      let leanTarget = 0;
      if (phase === "countdown") leanTarget = -0.1;
      else if (phase === "racing" || phase === "finishing")
        leanTarget = -0.045 - b.velocity * 0.035;
      else if (phase === "podium" && b.finishRank === 0) leanTarget = -0.18;
      else if (phase === "podium" && b.finishRank < 3) leanTarget = -0.06;
      b.lean = damp(b.lean, leanTarget, 6, dt);

      const spinRate =
        phase === "idle"
          ? 2.5
          : phase === "countdown"
            ? 8
            : phase === "podium"
              ? 3
              : 14 + Math.abs(b.velocity) * 50;
      b.wheelSpin += spinRate * dt;
      b.wheelF.rotation = b.wheelSpin;
      b.wheelR.rotation = b.wheelSpin * 0.97;

      let x: number;
      let y: number;
      if (phase === "idle" || phase === "countdown") {
        x = startX + vib * 0.25;
        y = b.baseY + b.bounce;
      } else if (phase === "podium") {
        // Ease bikes onto podium spots
        x = damp(b.root.x, b.podiumX, 4.5, dt);
        y = damp(b.root.y, b.podiumY + b.bounce * 0.3, 4.5, dt);
      } else {
        // Racing / finishing: move along track to fixed finish X
        x = this.progressToX(b.progress, startX, endX) + vib * 0.25;
        y = b.baseY + b.bounce;
      }

      b.root.x = x;
      b.root.y = y;
      b.body.rotation = b.lean + b.rock;
      b.root.scale.set(b.scalePunch);

      b.shadow.scale.y = 1 - Math.abs(b.lean) * 0.7;
      b.shadow.alpha = phase === "idle" ? 0.32 : 0.4;
      b.shadow.x = Math.abs(b.lean) * 5;

      b.headlight.alpha =
        phase === "idle"
          ? 0.5
          : 0.7 + Math.sin(t * 3 + seed) * 0.08 + (racing ? 0.15 : 0);
      b.taillight.alpha = phase === "finishing" ? 0.95 : 0.65;
      b.glow.alpha =
        phase === "idle"
          ? 0.08
          : 0.12 +
            (b.finishRank === 0 && phase === "podium" ? 0.4 : 0) +
            Math.min(0.18, Math.abs(b.velocity) * 0.12);

      // Particles only when actually racing / finishing
      if (phase === "racing" || phase === "finishing") {
        particles.emitExhaust(x - 4, b.root.y + 2, 1);
        if (Math.random() < 0.06) particles.emitDust(x + 4, b.root.y + 4);
        if (b.velocity > 0.55 && Math.random() < 0.1) {
          particles.emitNitro(x, b.root.y);
        }
      } else if (phase === "countdown" && Math.random() < 0.15) {
        particles.emitExhaust(x - 4, b.root.y + 2, 0.5);
      }

      b.exhaust.alpha =
        phase === "idle"
          ? 0.15
          : 0.3 + Math.sin(t * 16 + seed) * 0.2;
    }
  }

  assignFinishOrder(order: number[]) {
    for (const b of this.bikes) {
      const rank = order.indexOf(b.number);
      b.finishRank = rank < 0 ? 9 : rank;
      b.finishTarget = Math.max(0.58, 1 - b.finishRank * 0.052);
    }
  }

  winner() {
    return this.bikes.find((b) => b.finishRank === 0) ?? null;
  }

  /** Podium bikes 1–3 */
  podiumBikes() {
    return this.bikes
      .filter((b) => b.finishRank >= 0 && b.finishRank < 3)
      .sort((a, b) => a.finishRank - b.finishRank);
  }

  destroy() {
    this.layer.destroy({ children: true });
    this.bikes = [];
  }
}
