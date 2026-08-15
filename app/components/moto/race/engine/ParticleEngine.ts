import type { Application, Container, Graphics } from "pixi.js";
import type * as PIXI from "pixi.js";

interface Particle {
  g: Graphics;
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  drag: number;
  kind: "dust" | "smoke" | "nitro" | "spark" | "confetti" | "ambient";
}

const POOL = 180;

/**
 * Object-pooled particle system — dust, nitro, sparks, confetti, ambient.
 */
export class ParticleEngine {
  private layer: Container;
  private pool: Particle[] = [];
  private pixi: typeof PIXI;
  private w = 320;
  private h = 200;

  constructor(app: Application, pixi: typeof PIXI) {
    this.pixi = pixi;
    this.layer = new pixi.Container();
    this.layer.zIndex = 50;
    this.layer.sortableChildren = true;
    app.stage.addChild(this.layer);
    this.w = app.screen.width;
    this.h = app.screen.height;

    for (let i = 0; i < POOL; i++) {
      const g = new pixi.Graphics();
      g.visible = false;
      this.layer.addChild(g);
      this.pool.push({
        g,
        alive: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        vr: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        gravity: 0,
        drag: 0.98,
        kind: "dust",
      });
    }
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private acquire(): Particle | null {
    for (const p of this.pool) {
      if (!p.alive) return p;
    }
    return null;
  }

  private spawn(
    kind: Particle["kind"],
    x: number,
    y: number,
    opts: Partial<Particle> & { color: number }
  ) {
    const p = this.acquire();
    if (!p) return;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.vr = opts.vr ?? 0;
    p.life = opts.maxLife ?? 0.6;
    p.maxLife = p.life;
    p.size = opts.size ?? 2;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0.98;
    p.g.visible = true;
    p.g.clear();
    const c = opts.color;
    if (kind === "confetti") {
      p.g.rect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55).fill({
        color: c,
      });
    } else if (kind === "spark") {
      p.g
        .moveTo(0, -p.size)
        .lineTo(p.size * 0.3, 0)
        .lineTo(0, p.size)
        .lineTo(-p.size * 0.3, 0)
        .closePath()
        .fill({ color: c });
    } else {
      p.g.circle(0, 0, p.size).fill({ color: c, alpha: 0.9 });
    }
    p.g.position.set(x, y);
    p.g.alpha = 1;
    p.g.rotation = Math.random() * Math.PI;
  }

  emitExhaust(x: number, y: number, intensity = 1) {
    if (Math.random() > 0.55 * intensity) return;
    this.spawn("smoke", x - 10, y + 2, {
      color: 0x888899,
      vx: -40 - Math.random() * 50 * intensity,
      vy: -10 + Math.random() * 16,
      size: 1.5 + Math.random() * 2.5,
      maxLife: 0.25 + Math.random() * 0.25,
      gravity: -20,
      drag: 0.94,
    });
  }

  emitNitro(x: number, y: number) {
    this.spawn("nitro", x - 14, y, {
      color: Math.random() > 0.5 ? 0x2ee6ff : 0x3b8cff,
      vx: -120 - Math.random() * 80,
      vy: (Math.random() - 0.5) * 30,
      size: 2 + Math.random() * 3,
      maxLife: 0.15 + Math.random() * 0.12,
      gravity: 0,
      drag: 0.9,
    });
  }

  emitDust(x: number, y: number) {
    if (Math.random() > 0.35) return;
    this.spawn("dust", x + 8, y + 10, {
      color: 0xc4a574,
      vx: -30 - Math.random() * 40,
      vy: -5 + Math.random() * 10,
      size: 1 + Math.random() * 2,
      maxLife: 0.3 + Math.random() * 0.2,
      gravity: 40,
      drag: 0.96,
    });
  }

  emitSparks(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) {
      this.spawn("spark", x, y, {
        color: 0xfed358,
        vx: (Math.random() - 0.5) * 160,
        vy: -40 - Math.random() * 80,
        vr: (Math.random() - 0.5) * 10,
        size: 1.5 + Math.random() * 2,
        maxLife: 0.35 + Math.random() * 0.25,
        gravity: 220,
        drag: 0.97,
      });
    }
  }

  emitConfetti(x: number, y: number, n = 48) {
    const colors = [
      0xfed358, 0xff6b6b, 0x60a5fa, 0x4ade80, 0xc084fc, 0xfbbf24, 0xffffff,
    ];
    for (let i = 0; i < n; i++) {
      this.spawn("confetti", x + (Math.random() - 0.5) * 40, y, {
        color: colors[i % colors.length]!,
        vx: (Math.random() - 0.5) * 200,
        vy: -60 - Math.random() * 120,
        vr: (Math.random() - 0.5) * 12,
        size: 3 + Math.random() * 4,
        maxLife: 1.2 + Math.random() * 0.8,
        gravity: 280,
        drag: 0.99,
      });
    }
  }

  emitAmbient() {
    if (Math.random() > 0.08) return;
    this.spawn("ambient", Math.random() * this.w, Math.random() * this.h * 0.5, {
      color: 0xfed358,
      vx: (Math.random() - 0.5) * 12,
      vy: -8 - Math.random() * 12,
      size: 0.8 + Math.random() * 1.2,
      maxLife: 2 + Math.random() * 2,
      gravity: -4,
      drag: 0.995,
    });
  }

  update(dt: number, ambient = false) {
    if (ambient) this.emitAmbient();
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.g.position.set(p.x, p.y);
      p.g.rotation += p.vr * dt;
      const u = Math.max(0, p.life / p.maxLife);
      p.g.alpha = u * (p.kind === "nitro" ? 0.9 : 0.75);
      p.g.scale.set(0.6 + (1 - u) * 0.8);
      if (p.life <= 0) {
        p.alive = false;
        p.g.visible = false;
      }
    }
  }

  clear() {
    for (const p of this.pool) {
      p.alive = false;
      p.g.visible = false;
    }
  }

  destroy() {
    this.clear();
    this.layer.destroy({ children: true });
  }
}
