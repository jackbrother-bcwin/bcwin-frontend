import type { Application, Container, Graphics, Text } from "pixi.js";
import type { PodiumResult } from "../../types";

export type RacePhase =
  | "idle"
  | "countdown"
  | "racing"
  | "finishing"
  | "podium";

export interface BikeRuntime {
  number: number;
  root: Container;
  body: Container;
  chassis: Graphics;
  wheelF: Graphics;
  wheelR: Graphics;
  glow: Graphics;
  shadow: Graphics;
  exhaust: Graphics;
  headlight: Graphics;
  taillight: Graphics;
  label: Text;
  baseY: number;
  /** 0..1 track progress */
  progress: number;
  velocity: number;
  targetVelocity: number;
  bounce: number;
  bounceVel: number;
  rock: number;
  rockVel: number;
  lean: number;
  wheelSpin: number;
  engineHz: number;
  seed: number;
  finishRank: number;
  finishTarget: number;
  scalePunch: number;
  /** Podium ceremony screen positions (set on enterPodium) */
  podiumX: number;
  podiumY: number;
  rankBadge: Text | null;
}

export interface EngineContext {
  app: Application;
  stage: Container;
  world: Container;
  w: number;
  h: number;
  t: number;
  dt: number;
  phase: RacePhase;
  roadScroll: number;
  speedFeel: number;
  finishLineX: number;
  startX: number;
}

export type { PodiumResult };
