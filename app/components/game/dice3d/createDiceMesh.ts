/**
 * Glossy casino-style d6 meshes (canvas pips + clearcoat).
 * Box material order: +X, -X, +Y, -Y, +Z, -Z → faces 2, 5, 1, 6, 3, 4
 */

import * as THREE from "three";

const FACE_ORDER = [2, 5, 1, 6, 3, 4] as const;

/** Local normals for faces 1–6 (1 opposite 6, 2 opp 5, 3 opp 4). */
export const FACE_NORMALS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(0, 1, 0),
  2: new THREE.Vector3(1, 0, 0),
  3: new THREE.Vector3(0, 0, 1),
  4: new THREE.Vector3(0, 0, -1),
  5: new THREE.Vector3(-1, 0, 0),
  6: new THREE.Vector3(0, -1, 0),
};

const PIP: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.28, 0.28],
    [0.5, 0.5],
    [0.72, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.28, 0.22],
    [0.72, 0.22],
    [0.28, 0.5],
    [0.72, 0.5],
    [0.28, 0.78],
    [0.72, 0.78],
  ],
};

function drawFace(face: number, size = 256): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  // Cream plastic body
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#fffef9");
  grad.addColorStop(0.55, "#f4efe4");
  grad.addColorStop(1, "#e8e0d0");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Soft vignette
  const vig = ctx.createRadialGradient(
    size * 0.5,
    size * 0.4,
    size * 0.1,
    size * 0.5,
    size * 0.5,
    size * 0.72,
  );
  vig.addColorStop(0, "rgba(255,255,255,0.35)");
  vig.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, size, size);

  // Rounded inset border
  const inset = size * 0.06;
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = size * 0.02;
  roundRect(ctx, inset, inset, size - inset * 2, size - inset * 2, size * 0.12);
  ctx.stroke();

  const pips = PIP[face] ?? PIP[1]!;
  const r = size * (face === 1 ? 0.14 : 0.1);
  for (const [px, py] of pips) {
    const x = px * size;
    const y = py * size;
    const pipGrad = ctx.createRadialGradient(
      x - r * 0.3,
      y - r * 0.35,
      r * 0.1,
      x,
      y,
      r,
    );
    if (face === 1) {
      pipGrad.addColorStop(0, "#ff6b6b");
      pipGrad.addColorStop(0.55, "#d62828");
      pipGrad.addColorStop(1, "#8b1010");
    } else {
      pipGrad.addColorStop(0, "#3a3a42");
      pipGrad.addColorStop(0.55, "#1a1a1e");
      pipGrad.addColorStop(1, "#0a0a0c");
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = pipGrad;
    ctx.fill();
    // Spec highlight on pip
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fill();
  }

  return c;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let sharedMaterials: THREE.MeshPhysicalMaterial[] | null = null;
let sharedGeo: THREE.BoxGeometry | null = null;

function getSharedMaterials(): THREE.MeshPhysicalMaterial[] {
  if (sharedMaterials) return sharedMaterials;
  sharedMaterials = FACE_ORDER.map((face) => {
    const tex = new THREE.CanvasTexture(drawFace(face));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      reflectivity: 0.45,
      envMapIntensity: 0.9,
    });
  });
  return sharedMaterials;
}

function getSharedGeo(size: number): THREE.BoxGeometry {
  if (!sharedGeo) {
    sharedGeo = new THREE.BoxGeometry(size, size, size, 1, 1, 1);
  }
  return sharedGeo;
}

export type DiceBody = {
  mesh: THREE.Group;
  cube: THREE.Mesh;
  /** half extent */
  half: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  quat: THREE.Quaternion;
  /** settle target */
  targetFace: number;
  settling: boolean;
  settled: boolean;
  lastBounceAt: number;
};

export function createDiceBody(
  size = 0.72,
  colorTint?: number,
): DiceBody {
  const half = size / 2;
  const materials = getSharedMaterials().map((m) => m.clone());
  if (colorTint != null) {
    materials.forEach((m) => {
      m.color = new THREE.Color(colorTint);
    });
  }
  const cube = new THREE.Mesh(getSharedGeo(size), materials);
  cube.castShadow = true;
  cube.receiveShadow = true;

  // Slight edge bevel look via dark edges (EdgesGeometry helper)
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(getSharedGeo(size), 20),
    new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.12,
    }),
  );
  cube.add(edges);

  const mesh = new THREE.Group();
  mesh.add(cube);

  return {
    mesh,
    cube,
    half,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    angVel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    targetFace: 1,
    settling: false,
    settled: false,
    lastBounceAt: 0,
  };
}

/**
 * Quaternion that puts `face` on world +Y, with optional yaw around up.
 */
export function quatForFaceUp(face: number, yaw = 0): THREE.Quaternion {
  const n = FACE_NORMALS[Math.min(6, Math.max(1, face))] ?? FACE_NORMALS[1]!;
  const qAlign = new THREE.Quaternion().setFromUnitVectors(
    n.clone().normalize(),
    new THREE.Vector3(0, 1, 0),
  );
  const qYaw = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    yaw,
  );
  return qYaw.multiply(qAlign);
}

/** Which face is currently closest to world up? */
export function readUpFace(quat: THREE.Quaternion): number {
  const up = new THREE.Vector3(0, 1, 0);
  let best = 1;
  let bestDot = -Infinity;
  for (let f = 1; f <= 6; f++) {
    const n = FACE_NORMALS[f]!.clone().applyQuaternion(quat);
    const d = n.dot(up);
    if (d > bestDot) {
      bestDot = d;
      best = f;
    }
  }
  return best;
}

export function disposeDiceShared() {
  if (sharedMaterials) {
    for (const m of sharedMaterials) {
      m.map?.dispose();
      m.dispose();
    }
    sharedMaterials = null;
  }
  sharedGeo?.dispose();
  sharedGeo = null;
}
