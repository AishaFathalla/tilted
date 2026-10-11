import type { Vector } from "../../shared/protocol";

export const MOTION = {
  fullScaleDegrees: 30,
  deadZone: 0.08,
  smoothing: 0.2,
  zeroSnap: 0.001,
  sensorTimeoutMs: 2000,
} as const;

export type Pose = { beta: number; gamma: number };

export type ScreenAngle = 0 | 90 | 180 | 270;

// Portrait-natural phones: 0 = portrait; 90 = phone top on left; 180 = upside-down portrait;
// 270 = phone top on right. Use angles, not landscape-primary/secondary (their assignment varies).
export function screenAngle(angle: number | undefined): ScreenAngle | undefined {
  if (angle === undefined || !Number.isFinite(angle)) return undefined;
  const normalized = ((angle % 360) + 360) % 360;
  return normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270 ? normalized : undefined;
}

// Tilt in the phone's portrait frame (right edge down = +gamma, top edge down/away = -beta),
// rotated by the screen angle so directions follow the screen.
export function motionTarget(pose: Pose, neutral: Pose, angle: ScreenAngle): Vector {
  const betaDelta = ((pose.beta - neutral.beta + 540) % 360) - 180;
  const gammaDelta = pose.gamma - neutral.gamma;
  const [rawX, rawY] = angle === 0 ? [gammaDelta, -betaDelta]
    : angle === 90 ? [betaDelta, gammaDelta]
    : angle === 180 ? [-gammaDelta, betaDelta]
    : [-betaDelta, -gammaDelta];
  let x = rawX / MOTION.fullScaleDegrees;
  let y = rawY / MOTION.fullScaleDegrees;
  const clamp = Math.max(1, Math.hypot(x, y));
  x /= clamp;
  y /= clamp;
  const radius = Math.hypot(x, y);
  if (radius <= MOTION.deadZone) return { x: 0, y: 0 };
  const scale = (radius - MOTION.deadZone) / ((1 - MOTION.deadZone) * radius);
  return { x: x * scale, y: y * scale };
}

export function smoothVector(previous: Vector, target: Vector): Vector {
  const x = previous.x + MOTION.smoothing * (target.x - previous.x);
  const y = previous.y + MOTION.smoothing * (target.y - previous.y);
  return target.x === 0 && target.y === 0 && Math.hypot(x, y) < MOTION.zeroSnap
    ? { x: 0, y: 0 } : { x, y };
}
