import type { Vector } from "../../shared/protocol";

/** Up to 75% extra acceleration for shared direction, independent of tilt strength. */
export function teamworkBoost(vectors: Vector[]): number {
  let x = 0, y = 0, active = 0;
  for (const vector of vectors) {
    const magnitude = Math.hypot(vector.x, vector.y);
    if (magnitude < 0.08) continue;
    x += vector.x / magnitude;
    y += vector.y / magnitude;
    active++;
  }
  if (active < 2) return 1;
  const agreement = Math.hypot(x, y) / active;
  const alignment = Math.max(0, Math.min(1, (agreement - 0.75) / 0.25));
  return 1 + 0.75 * alignment * alignment * (active / vectors.length);
}
