/**
 * Three.js K3 dice tray — glossy look + bounce/settle physics.
 * Final faces are forced to server results during settle (lottery-safe).
 */

import * as THREE from "three";
import {
  createDiceBody,
  disposeDiceShared,
  quatForFaceUp,
  type DiceBody,
} from "./createDiceMesh";
import { playDiceLand, playDiceRattle } from "../../../lib/dice-audio";

export type DiceTriple = [number, number, number];

type Phase = "idle" | "rolling" | "settling" | "landed";

const GRAVITY = -28;
const RESTITUTION = 0.48;
const FRICTION = 0.82;
const ANG_DAMP = 0.985;
const LIN_DAMP = 0.995;
const FLOOR_Y = 0;
const DICE_SIZE = 0.72;
const HALF = DICE_SIZE / 2;

// Soft tray walls (half extents)
const TRAY_X = 1.55;
const TRAY_Z = 1.05;

export class Dice3DEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private dice: DiceBody[] = [];
  private shadows: THREE.Mesh[] = [];
  private clock = new THREE.Clock();
  private raf = 0;
  private phase: Phase = "idle";
  private rollStartedAt = 0;
  private settleStartedAt = 0;
  private target: DiceTriple = [1, 1, 1];
  private yawOffsets = [0, 0, 0];
  private onLanded?: () => void;
  private bounceCooldown = 0;
  private disposed = false;
  private camBase = new THREE.Vector3(0, 3.6, 3.2);
  private camShake = 0;
  private envMap: THREE.Texture | null = null;
  private lastRattleAt = 0;
  private reboostCount = 0;
  private paused = false;
  private idleFrameSkip = 0;
  /** scratch — avoid per-frame allocations that can stall the UI thread */
  private readonly _ang = new THREE.Vector3();
  private readonly _euler = new THREE.Euler();
  private readonly _dq = new THREE.Quaternion();

  constructor(private canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth || 360;
    const h = canvas.clientHeight || 200;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    // Cap DPR hard — dice stage is small; 1.25 is enough for glossy look
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    // Shadows off by default — contact blobs are enough; shadows kill low-end FPS
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 40);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0.15, 0);

    this.buildEnvironment();
    this.spawnDice();
    this.layoutIdle(this.target);

    this.clock.start();
    this.loop();
  }

  private buildEnvironment() {
    // Soft HDR-ish ambient via lights (no external env map file)
    const amb = new THREE.AmbientLight(0xfff0e0, 0.55);
    this.scene.add(amb);

    const key = new THREE.DirectionalLight(0xfff5e8, 1.65);
    key.position.set(2.2, 5.5, 2.8);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.45);
    fill.position.set(-3, 2.5, -1.5);
    this.scene.add(fill);

    const rim = new THREE.PointLight(0xfed358, 1.1, 12);
    rim.position.set(0, 1.2, -1.8);
    this.scene.add(rim);

    // Felt tray floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1c3d2e,
      roughness: 0.92,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.8),
      floorMat,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle felt grain (noise via canvas)
    const grain = document.createElement("canvas");
    grain.width = 128;
    grain.height = 128;
    const gctx = grain.getContext("2d")!;
    gctx.fillStyle = "#1c3d2e";
    gctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      gctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      gctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
    const grainTex = new THREE.CanvasTexture(grain);
    grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
    grainTex.repeat.set(6, 4);
    floorMat.map = grainTex;
    floorMat.needsUpdate = true;

    // Gold tray rim
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xc9a227,
      metalness: 0.75,
      roughness: 0.35,
    });
    const rimGeo = new THREE.BoxGeometry(4.35, 0.12, 2.95);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.02;
    // Hollow rim: outer only via edges — simple raised border pieces
    this.scene.remove(rimMesh);
    const wallH = 0.55;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a1f18,
      roughness: 0.7,
      metalness: 0.15,
    });
    const walls: [number, number, number, number, number, number][] = [
      // w, h, d, x, y, z
      [4.2, wallH, 0.12, 0, wallH / 2, -1.4],
      [4.2, wallH, 0.12, 0, wallH / 2, 1.4],
      [0.12, wallH, 2.8, -2.1, wallH / 2, 0],
      [0.12, wallH, 2.8, 2.1, wallH / 2, 0],
    ];
    for (const [ww, wh, wd, x, y, z] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wallMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // Gold trim on top of walls
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xfed358,
      metalness: 0.85,
      roughness: 0.28,
      emissive: 0x3a2a00,
      emissiveIntensity: 0.15,
    });
    for (const [ww, , wd, x, , z] of walls) {
      const t = new THREE.Mesh(
        new THREE.BoxGeometry(ww + 0.02, 0.05, wd + 0.02),
        trimMat,
      );
      t.position.set(x, wallH + 0.02, z);
      this.scene.add(t);
    }

    // Soft ground fog / vignette plane under tray
    const under = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
      }),
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.02;
    this.scene.add(under);

    // Fake env for clearcoat reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.AmbientLight(0xffffff, 1));
    const c1 = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 16),
      new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        color: 0x2a2228,
      }),
    );
    envScene.add(c1);
    const c2 = new THREE.Mesh(
      new THREE.SphereGeometry(2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfed358 }),
    );
    c2.position.set(3, 4, 2);
    envScene.add(c2);
    const c3 = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    c3.position.set(-4, 3, -2);
    envScene.add(c3);
    this.envMap = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();
  }

  private spawnDice() {
    const slots = [-0.95, 0, 0.95];
    for (let i = 0; i < 3; i++) {
      const d = createDiceBody(DICE_SIZE);
      d.pos.set(slots[i]!, HALF + 0.01, 0);
      d.quat.copy(quatForFaceUp(1, i * 0.4));
      this.syncMesh(d);
      this.scene.add(d.mesh);

      // Contact blob shadow
      const sh = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 24),
        new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = 0.01;
      this.scene.add(sh);
      this.shadows.push(sh);
      this.dice.push(d);
    }
  }

  private syncMesh(d: DiceBody) {
    d.mesh.position.copy(d.pos);
    d.mesh.quaternion.copy(d.quat);
  }

  private layoutIdle(faces: DiceTriple) {
    const slots = [-0.95, 0, 0.95];
    faces.forEach((f, i) => {
      const d = this.dice[i]!;
      d.pos.set(slots[i]!, HALF + 0.01, (i - 1) * 0.08);
      d.vel.set(0, 0, 0);
      d.angVel.set(0, 0, 0);
      d.quat.copy(quatForFaceUp(f, this.yawOffsets[i] ?? i * 0.35));
      d.targetFace = f;
      d.settling = false;
      d.settled = true;
      this.syncMesh(d);
      this.updateShadow(i);
    });
  }

  private updateShadow(i: number) {
    const d = this.dice[i]!;
    const sh = this.shadows[i]!;
    sh.position.x = d.pos.x;
    sh.position.z = d.pos.z;
    const height = Math.max(0, d.pos.y - HALF);
    const scale = 1 + height * 0.55;
    const opacity = Math.max(0.08, 0.42 - height * 0.18);
    sh.scale.setScalar(scale);
    (sh.material as THREE.MeshBasicMaterial).opacity = opacity;
  }

  setIdleFaces(faces: DiceTriple) {
    if (this.phase === "rolling" || this.phase === "settling") return;
    this.target = faces;
    this.layoutIdle(faces);
    this.phase = "idle";
  }

  private rattle(intensity: number) {
    const now = performance.now();
    // Hard throttle — buffer creation every frame freezes countdown UI
    if (now - this.lastRattleAt < 90) return;
    this.lastRattleAt = now;
    playDiceRattle(intensity);
  }

  startRolling() {
    if (this.phase === "rolling" || this.phase === "settling") return;
    this.phase = "rolling";
    this.rollStartedAt = performance.now();
    this.reboostCount = 0;
    this.yawOffsets = [
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
    ];

    this.dice.forEach((d, i) => {
      d.settled = false;
      d.settling = false;
      // Toss up from slots with spin
      d.pos.set(
        -0.95 + i * 0.95 + (Math.random() - 0.5) * 0.15,
        1.1 + Math.random() * 0.35,
        (Math.random() - 0.5) * 0.25,
      );
      d.vel.set(
        (Math.random() - 0.5) * 3.5,
        2.5 + Math.random() * 2.2,
        (Math.random() - 0.5) * 3.2,
      );
      d.angVel.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 22,
      );
      this._euler.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );
      d.quat.setFromEuler(this._euler);
      this.syncMesh(d);
    });
    this.camShake = 0.12;
    this.rattle(0.7);
  }

  /** Force settle onto known lottery faces */
  landOn(faces: DiceTriple, onLanded?: () => void) {
    // Already settling/landed on same faces — only refresh callback
    if (
      this.phase === "settling" &&
      this.target[0] === faces[0] &&
      this.target[1] === faces[1] &&
      this.target[2] === faces[2]
    ) {
      if (onLanded) this.onLanded = onLanded;
      return;
    }
    if (
      this.phase === "landed" &&
      this.target[0] === faces[0] &&
      this.target[1] === faces[1] &&
      this.target[2] === faces[2]
    ) {
      onLanded?.();
      return;
    }

    this.target = faces;
    this.onLanded = onLanded;
    // Ensure we've been rolling a bit; if not, kick a short toss first
    if (this.phase === "idle" || this.phase === "landed") {
      this.startRolling();
    }
    this.phase = "settling";
    this.settleStartedAt = performance.now();
    this.dice.forEach((d, i) => {
      d.targetFace = faces[i]!;
      d.settling = true;
      d.settled = false;
      // Nudge so they keep bouncing a moment while we blend orientation
      if (d.pos.y < HALF + 0.4) {
        d.vel.y = Math.max(d.vel.y, 1.8 + Math.random());
      }
      d.angVel.multiplyScalar(0.6);
      d.angVel.x += (Math.random() - 0.5) * 6;
      d.angVel.z += (Math.random() - 0.5) * 6;
    });
  }

  getPhase() {
    return this.phase;
  }

  /** Pause rAF work when tab hidden — keeps main-thread free for countdown */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused && !this.disposed) {
      this.clock.getDelta(); // drop backlog
      if (!this.raf) this.loop();
    }
  }

  resize() {
    if (this.disposed) return;
    const w = this.canvas.clientWidth || 360;
    const h = this.canvas.clientHeight || 200;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    // One frame so idle looks correct after rotate
    if (this.phase === "idle" || this.phase === "landed") {
      this.renderCam(0.016);
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.renderer.dispose();
    this.envMap?.dispose();
    disposeDiceShared();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    if (this.paused) return;

    const active = this.phase === "rolling" || this.phase === "settling";
    // Idle: render ~10fps for gentle camera drift only (cheap)
    if (!active) {
      this.idleFrameSkip += 1;
      if (this.idleFrameSkip % 6 !== 0) return;
    } else {
      this.idleFrameSkip = 0;
    }

    const dt = Math.min(this.clock.getDelta(), 0.033);
    if (active) this.step(dt);
    this.renderCam(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private renderCam(dt: number) {
    // Gentle idle orbit + shake on bounce
    const t = performance.now() * 0.001;
    const idle = this.phase === "idle" || this.phase === "landed";
    const ox = idle ? Math.sin(t * 0.35) * 0.12 : Math.sin(t * 1.2) * 0.08;
    const oz = idle ? Math.cos(t * 0.28) * 0.08 : 0;

    this.camShake *= Math.pow(0.08, dt);
    const shakeX = (Math.random() - 0.5) * this.camShake;
    const shakeY = (Math.random() - 0.5) * this.camShake * 0.6;

    this.camera.position.set(
      this.camBase.x + ox + shakeX,
      this.camBase.y + shakeY,
      this.camBase.z + oz,
    );
    this.camera.lookAt(0, 0.2, 0);
  }

  private step(dt: number) {
    if (this.phase === "idle" || this.phase === "landed") {
      // micro idle wobble
      return;
    }

    this.bounceCooldown = Math.max(0, this.bounceCooldown - dt);
    let anyMoving = false;
    let allNearlySettled = true;

    for (let i = 0; i < this.dice.length; i++) {
      const d = this.dice[i]!;
      if (d.settled) {
        this.updateShadow(i);
        continue;
      }

      // Gravity
      d.vel.y += GRAVITY * dt;
      d.vel.multiplyScalar(LIN_DAMP);
      d.pos.addScaledVector(d.vel, dt);

      // Integrate spin (scratch vectors — no per-frame clone/new)
      this._ang.copy(d.angVel).multiplyScalar(dt);
      this._euler.set(this._ang.x, this._ang.y, this._ang.z, "XYZ");
      this._dq.setFromEuler(this._euler);
      d.quat.multiply(this._dq).normalize();
      d.angVel.multiplyScalar(ANG_DAMP);

      // Floor collision
      if (d.pos.y < HALF) {
        d.pos.y = HALF;
        if (d.vel.y < 0) {
          const impact = Math.abs(d.vel.y);
          d.vel.y = -d.vel.y * RESTITUTION;
          d.vel.x *= FRICTION;
          d.vel.z *= FRICTION;
          d.angVel.x *= 0.7;
          d.angVel.z *= 0.7;
          // Friction torque from slide
          d.angVel.y += d.vel.x * 0.5;
          if (impact > 1.2 && this.bounceCooldown <= 0) {
            this.rattle(Math.min(1, impact / 8));
            this.camShake = Math.min(0.18, impact * 0.02);
            this.bounceCooldown = 0.08;
            d.lastBounceAt = performance.now();
          }
          // Stick when slow
          if (impact < 0.9 && d.vel.lengthSq() < 1.44) {
            d.vel.y = 0;
          }
        }
      }

      // Soft walls
      if (d.pos.x < -TRAY_X + HALF) {
        d.pos.x = -TRAY_X + HALF;
        d.vel.x = Math.abs(d.vel.x) * RESTITUTION;
      } else if (d.pos.x > TRAY_X - HALF) {
        d.pos.x = TRAY_X - HALF;
        d.vel.x = -Math.abs(d.vel.x) * RESTITUTION;
      }
      if (d.pos.z < -TRAY_Z + HALF) {
        d.pos.z = -TRAY_Z + HALF;
        d.vel.z = Math.abs(d.vel.z) * RESTITUTION;
      } else if (d.pos.z > TRAY_Z - HALF) {
        d.pos.z = TRAY_Z - HALF;
        d.vel.z = -Math.abs(d.vel.z) * RESTITUTION;
      }

      // Dice-dice soft separation
      for (let j = i + 1; j < this.dice.length; j++) {
        const o = this.dice[j]!;
        const dx = d.pos.x - o.pos.x;
        const dy = d.pos.y - o.pos.y;
        const dz = d.pos.z - o.pos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        const min = DICE_SIZE * 0.95;
        if (dist < min) {
          const push = ((min - dist) / dist) * 0.5;
          d.pos.x += dx * push;
          d.pos.y += dy * push * 0.3;
          d.pos.z += dz * push;
          o.pos.x -= dx * push;
          o.pos.y -= dy * push * 0.3;
          o.pos.z -= dz * push;
          // exchange a bit of velocity
          const dvx = d.vel.x - o.vel.x;
          d.vel.x -= dvx * 0.25;
          o.vel.x += dvx * 0.25;
        }
      }

      // Settle blend toward target face
      if (this.phase === "settling" && d.settling) {
        const elapsed = (performance.now() - this.settleStartedAt) / 1000;
        const speed = d.vel.length() + d.angVel.length() * 0.08;
        // After 0.35s start orienting; by 1.1s lock
        const blend = Math.min(1, Math.max(0, (elapsed - 0.25) / 0.85));
        if (blend > 0) {
          const targetQ = quatForFaceUp(
            d.targetFace,
            this.yawOffsets[i] ?? 0,
          );
          d.quat.slerp(targetQ, 0.12 + blend * 0.35);
          d.angVel.multiplyScalar(1 - blend * 0.15);
        }

        // Park into neat slot near end
        if (blend > 0.55) {
          const slots = [-0.95, 0, 0.95];
          const tx = slots[i]!;
          const tz = (i - 1) * 0.08;
          d.pos.x += (tx - d.pos.x) * 0.08 * blend;
          d.pos.z += (tz - d.pos.z) * 0.08 * blend;
        }

        if (
          (blend >= 1 && speed < 0.55 && d.pos.y <= HALF + 0.02) ||
          elapsed > 1.6
        ) {
          d.pos.y = HALF + 0.01;
          d.vel.set(0, 0, 0);
          d.angVel.set(0, 0, 0);
          d.quat.copy(quatForFaceUp(d.targetFace, this.yawOffsets[i] ?? 0));
          d.settled = true;
          d.settling = false;
        } else {
          allNearlySettled = false;
        }
      } else {
        allNearlySettled = false;
      }

      if (d.vel.lengthSq() > 0.0225 || d.angVel.lengthSq() > 0.16) {
        anyMoving = true;
      }

      this.syncMesh(d);
      this.updateShadow(i);
    }

    // Sparse ambient rattle while airborne (throttled)
    if (this.phase === "rolling" && anyMoving && Math.random() < 0.03) {
      this.rattle(0.25 + Math.random() * 0.2);
    }

    // Keep a bit of motion while waiting for result — limited reboosts only
    if (this.phase === "rolling") {
      const elapsed = (performance.now() - this.rollStartedAt) / 1000;
      if (
        elapsed > 0.9 &&
        !anyMoving &&
        this.reboostCount < 4
      ) {
        this.reboostCount += 1;
        this.dice.forEach((d) => {
          d.vel.y += 1.6 + Math.random() * 0.8;
          d.angVel.set(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 12,
          );
        });
      }
      // Safety: never roll more than ~6.5s without settle (keeps UI responsive)
      if (elapsed > 6.5) {
        this.landOn(this.target);
      }
    }

    if (this.phase === "settling" && allNearlySettled) {
      this.phase = "landed";
      playDiceLand();
      this.camShake = 0.08;
      const cb = this.onLanded;
      this.onLanded = undefined;
      // Defer callback so React state updates aren't nested inside rAF physics
      if (cb) queueMicrotask(cb);
    }
  }
}
