import type { Application, Container } from "pixi.js";
import type * as PIXI from "pixi.js";
import { BIKE_NUMBERS } from "../../constants";
import type { PodiumResult, RacePhase } from "./types";
import { smootherstep } from "./easing";
import { BikeEngine } from "./BikeEngine";
import { RoadEngine } from "./RoadEngine";
import { CameraEngine } from "./CameraEngine";
import { ParticleEngine } from "./ParticleEngine";
import { EffectsEngine } from "./EffectsEngine";

/**
 * Timeline:
 *   idle → countdown (3-2-1-GO) → racing → finishing → podium → idle
 */
export class RaceEngine {
  private app: Application;
  private pixi: typeof PIXI;
  private world: Container;
  private bikes: BikeEngine;
  private road: RoadEngine;
  private camera: CameraEngine;
  private particles: ParticleEngine;
  private effects: EffectsEngine;
  private phase: RacePhase = "idle";
  private raf = 0;
  private lastTs = 0;
  private t = 0;
  private destroyed = false;
  private finishBlend = 0;
  private finishDur = 2.8;
  private finishElapsed = 0;
  private finishResolve: ((ok: boolean) => void) | null = null;
  private speedFeel = 0;
  private startX = 28;
  private endX = 280;
  private starting = false;
  private podiumLayer: Container;
  private podiumBuilt = false;

  constructor(app: Application, pixi: typeof PIXI) {
    this.app = app;
    this.pixi = pixi;

    app.stage.sortableChildren = true;

    this.world = new pixi.Container();
    this.world.sortableChildren = true;
    this.world.zIndex = 1;
    app.stage.addChild(this.world);

    this.road = new RoadEngine(app, pixi);
    this.world.addChild(this.road.layer);

    this.podiumLayer = new pixi.Container();
    this.podiumLayer.zIndex = 15;
    this.podiumLayer.visible = false;
    this.world.addChild(this.podiumLayer);

    this.bikes = new BikeEngine(app, pixi);
    this.world.addChild(this.bikes.layer);

    this.camera = new CameraEngine(this.world);
    this.particles = new ParticleEngine(app, pixi);
    this.effects = new EffectsEngine(app, pixi);
    app.stage.addChild(this.effects.layer);

    this.syncSize();
    this.bikes.resetIdle(this.startX);
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  private syncSize() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.startX = Math.max(22, w * 0.06);
    this.endX = Math.max(this.startX + 90, w * 0.8);
    this.road.resize(w, h);
    this.bikes.resize(w, h);
    this.particles.resize(w, h);
    this.effects.resize(w, h);
    this.camera.setViewport(w, h);
    this.podiumBuilt = false;
  }

  private buildPodiumStands() {
    this.podiumLayer.removeChildren();
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w * 0.5;
    const base = h * 0.62;
    const g = new this.pixi.Graphics();

    // 2nd place stand (left, medium)
    g.roundRect(cx - w * 0.18 - 28, base - 18, 56, 36, 4).fill({
      color: 0x8a909a,
      alpha: 0.85,
    });
    // 1st place stand (center, tall)
    g.roundRect(cx - 32, base - 42, 64, 58, 4).fill({
      color: 0xfed358,
      alpha: 0.9,
    });
    // 3rd place stand (right, short)
    g.roundRect(cx + w * 0.18 - 26, base - 8, 52, 28, 4).fill({
      color: 0xb87333,
      alpha: 0.85,
    });

    // Gold glow under 1st
    g.ellipse(cx, base + 8, 40, 8).fill({ color: 0xfed358, alpha: 0.25 });

    this.podiumLayer.addChild(g);

    const title = new this.pixi.Text({
      text: "WINNERS",
      style: {
        fontSize: 18,
        fontWeight: "900",
        fill: 0xfed358,
        fontFamily: "system-ui,sans-serif",
      },
    });
    title.anchor.set(0.5);
    title.position.set(cx, base - 72);
    this.podiumLayer.addChild(title);

    this.podiumBuilt = true;
  }

  getPhase(): RacePhase {
    return this.phase;
  }

  resize() {
    if (this.destroyed) return;
    this.syncSize();
  }

  private loop = (now: number) => {
    if (this.destroyed) return;
    const raw = (now - this.lastTs) / 1000;
    this.lastTs = now;
    const dt = Math.min(0.048, Math.max(0, raw));
    this.t += dt;
    this.update(dt);
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    if (this.phase === "finishing") {
      this.finishElapsed += dt;
      this.finishBlend = smootherstep(
        Math.min(1, this.finishElapsed / this.finishDur)
      );
      this.speedFeel = 0.5 + (1 - this.finishBlend) * 0.45;
      if (this.finishBlend >= 1) this.enterPodium();
    } else if (this.phase === "racing") {
      this.speedFeel = dampToward(this.speedFeel, 0.9, 2.2, dt);
    } else if (this.phase === "countdown") {
      this.speedFeel = dampToward(this.speedFeel, 0.08, 4, dt);
    } else if (this.phase === "podium") {
      this.speedFeel = dampToward(this.speedFeel, 0.05, 3, dt);
    } else {
      // idle — calm world
      this.speedFeel = dampToward(this.speedFeel, 0, 5, dt);
    }

    const racing =
      this.phase === "racing" || this.phase === "finishing";

    this.road.update(dt, this.t, this.speedFeel, racing || this.phase === "countdown");
    this.bikes.update(
      dt,
      this.t,
      this.phase,
      this.startX,
      this.endX,
      this.particles,
      this.finishBlend
    );
    this.particles.update(
      dt,
      this.phase === "racing" || this.phase === "finishing"
    );
    this.camera.update(
      dt,
      this.t,
      this.phase === "idle" || this.phase === "countdown"
        ? 0.05
        : this.speedFeel
    );
    this.effects.update(dt);
  }

  private enterPodium() {
    this.phase = "podium";
    this.road.setFinishVisible(true);
    this.camera.setLocked(true);
    this.camera.setZoom(1.06);
    this.camera.addShake(0.25);
    this.effects.triggerFlash(0.22);
    this.effects.triggerWash(0.14);

    if (!this.podiumBuilt) this.buildPodiumStands();
    this.podiumLayer.visible = true;
    this.bikes.layoutPodium(this.app.screen.width, this.app.screen.height);

    const podium = this.bikes.podiumBikes();
    for (const b of podium) {
      if (b.finishRank === 0) {
        this.particles.emitConfetti(
          this.app.screen.width * 0.5,
          this.app.screen.height * 0.35,
          64
        );
        this.particles.emitSparks(b.root.x + 20, b.root.y, 14);
        b.scalePunch = 1.2;
      } else {
        this.particles.emitSparks(b.root.x + 8, b.root.y, 5);
        b.scalePunch = 1.1;
      }
    }

    this.finishResolve?.(true);
    this.finishResolve = null;
  }

  setIdle() {
    this.phase = "idle";
    this.starting = false;
    this.finishResolve?.(false);
    this.finishResolve = null;
    this.finishBlend = 0;
    this.finishElapsed = 0;
    this.camera.reset();
    this.camera.setZoom(1);
    this.camera.setLocked(false);
    this.particles.clear();
    this.road.setFinishVisible(false);
    this.podiumLayer.visible = false;
    this.bikes.resetIdle(this.startX);
    this.speedFeel = 0;
  }

  /**
   * Called once at bet lock (~10s left):
   * calm grid → 3-2-1-GO → high-speed race.
   * Never call this when a new period starts — only at lock window.
   */
  async startRacing() {
    if (this.destroyed || this.starting) return;
    // Only start from idle (or interrupted countdown) — never from podium
    if (
      this.phase === "racing" ||
      this.phase === "finishing" ||
      this.phase === "podium"
    ) {
      return;
    }

    this.starting = true;
    this.podiumLayer.visible = false;
    this.bikes.resetIdle(this.startX);
    this.phase = "countdown";
    this.camera.setLocked(false);
    this.camera.setZoom(1.04);
    this.road.setFinishVisible(true);
    this.speedFeel = 0.05;

    await this.effects.playCountdown((label) => {
      this.camera.addPunch(label === "GO!" ? 0.05 : 0.028);
      this.camera.addShake(label === "GO!" ? 0.28 : 0.1);
    });

    if (this.destroyed) {
      this.starting = false;
      return;
    }
    // If setIdle interrupted countdown (new period), abort launch
    if (this.phase !== "countdown") {
      this.starting = false;
      return;
    }

    this.phase = "racing";
    this.starting = false;
    this.camera.setZoom(1.02);
    this.camera.addShake(0.4);
    this.effects.triggerFlash(0.14);
    this.speedFeel = 0.45;

    for (const b of this.bikes.bikes) {
      b.progress = 0.05 + Math.random() * 0.04;
      b.velocity = 0.4 + Math.random() * 0.1;
      b.lean = -0.14;
    }
  }

  /**
   * Bikes ride to fixed finish line, then podium ceremony.
   * Does NOT play GO — use only after a race or for late result.
   */
  finishWithPodium(podium: PodiumResult): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.destroyed) {
        resolve(false);
        return;
      }
      if (
        podium.firstPlace == null ||
        podium.secondPlace == null ||
        podium.thirdPlace == null
      ) {
        resolve(false);
        return;
      }
      if (this.phase === "finishing" || this.phase === "podium") {
        resolve(false);
        return;
      }

      const rest = BIKE_NUMBERS.filter(
        (n) =>
          n !== podium.firstPlace &&
          n !== podium.secondPlace &&
          n !== podium.thirdPlace
      );
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j]!, rest[i]!];
      }
      this.bikes.assignFinishOrder([
        podium.firstPlace,
        podium.secondPlace,
        podium.thirdPlace,
        ...rest,
      ]);

      // Late join: seed mid-track (no GO countdown)
      if (this.phase === "idle" || this.phase === "countdown") {
        this.starting = false;
        for (const b of this.bikes.bikes) {
          b.progress = 0.4 + Math.random() * 0.12;
          b.velocity = 0.55;
        }
      }

      this.finishElapsed = 0;
      this.finishBlend = 0;
      this.finishDur = 2.6;
      this.finishResolve = resolve;
      this.phase = "finishing";
      // Lock camera so finish line stays planted — bikes move to it
      this.camera.setLocked(true);
      this.camera.setZoom(1.05);
      this.camera.addShake(0.2);
      this.effects.triggerWash(0.06);
      this.road.setFinishVisible(true);
      this.podiumLayer.visible = false;
    });
  }

  async playRace(podium: PodiumResult): Promise<boolean> {
    // Full sequence only if still idle at lock-equivalent
    if (this.phase === "idle") {
      await this.startRacing();
      await sleep(1500);
    }
    if (this.phase === "idle") {
      // start was aborted
      return this.finishWithPodium(podium);
    }
    return this.finishWithPodium(podium);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.finishResolve?.(false);
    this.finishResolve = null;
    this.bikes.destroy();
    this.road.destroy();
    this.particles.destroy();
    this.effects.destroy();
    this.world.destroy({ children: true });
  }
}

function dampToward(cur: number, target: number, lambda: number, dt: number) {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
