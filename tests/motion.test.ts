import assert from "node:assert/strict";
import { test } from "node:test";
import { landscapeAngle, motionTarget, smoothVector } from "../apps/controller/motion";

const neutral = { beta: 15, gamma: -5 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("calibrated neutral and radial dead zone are zero", () => {
  assert.deepEqual(motionTarget(neutral, neutral, 90), { x: 0, y: 0 });
  assert.deepEqual(motionTarget({ beta: 16, gamma: -4 }, neutral, 90), { x: 0, y: 0 });
  assert.ok(motionTarget({ beta: 13, gamma: -3 }, neutral, 90).y > 0); // Diagonal exceeds radial dead zone.
});
test("approved angle mapping reaches full strength in four directions", () => {
  for (const [beta, gamma, x, y] of [[15, 25, 0, 1], [15, -35, 0, -1], [-15, -5, -1, 0], [45, -5, 1, 0]]) {
    const value = motionTarget({ beta, gamma }, neutral, 90);
    near(value.x, x);
    near(value.y, y);
  }
});
test("radial clamp preserves diagonal direction and bounds magnitude", () => {
  const value = motionTarget({ beta: -45, gamma: 55 }, neutral, 90);
  near(value.x, -Math.SQRT1_2);
  near(value.y, Math.SQRT1_2);
  near(Math.hypot(value.x, value.y), 1);
});
test("dead zone rescales remaining range continuously", () => {
  near(motionTarget({ beta: 15, gamma: 10 }, neutral, 90).y, (0.5 - 0.08) / 0.92);
});
test("beta uses shortest angular difference across wrap", () => {
  const value = motionTarget({ beta: -179, gamma: 0 }, { beta: 179, gamma: 0 }, 90);
  assert.deepEqual(value, { x: 0, y: 0 });
});
test("simple smoothing converges, stays bounded, and settles to exact zero", () => {
  let value = smoothVector({ x: 0, y: 0 }, { x: 1, y: 0 });
  near(value.x, 0.2);
  for (let i = 0; i < 100; i++) value = smoothVector(value, { x: 1, y: 0 });
  assert.ok(value.x <= 1 && value.x > 1 - 1e-9);
  for (let i = 0; i < 100; i++) value = smoothVector(value, { x: 0, y: 0 });
  assert.deepEqual(value, { x: 0, y: 0 });
});


test("both landscape sides keep screen directions consistent", () => {
  for (const angle of [90, 270] as const) {
    const sign = angle === 90 ? 1 : -1;
    const right = motionTarget({ beta: neutral.beta + sign * 30, gamma: neutral.gamma }, neutral, angle);
    const up = motionTarget({ beta: neutral.beta, gamma: neutral.gamma + sign * 30 }, neutral, angle);
    near(right.x, 1); near(right.y, 0);
    near(up.x, 0); near(up.y, 1);
  }
});
test("screen angles support both sides and Safari negative angles; reject portrait", () => {
  assert.equal(landscapeAngle(90), 90);
  assert.equal(landscapeAngle(270), 270);
  assert.equal(landscapeAngle(-90), 270);
  for (const angle of [0, 180, undefined, NaN]) assert.equal(landscapeAngle(angle), undefined);
});
