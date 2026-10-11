import assert from "node:assert/strict";
import { test } from "node:test";
import { motionTarget, screenAngle, smoothVector } from "../apps/controller/motion";

const neutral = { beta: 15, gamma: -5 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("calibrated neutral and radial dead zone are zero", () => {
  assert.deepEqual(motionTarget(neutral, neutral, 90), { x: 0, y: 0 });
  assert.deepEqual(motionTarget({ beta: 16, gamma: -4 }, neutral, 90), { x: 0, y: 0 });
  assert.ok(motionTarget({ beta: 13, gamma: -3 }, neutral, 90).y > 0); // Diagonal exceeds radial dead zone.
});
test("approved angle mapping reaches full strength in four directions", () => {
  for (const [beta, gamma, x, y] of [[15, 15, 0, 1], [15, -25, 0, -1], [-5, -5, -1, 0], [35, -5, 1, 0]]) {
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
  near(motionTarget({ beta: 15, gamma: 5 }, neutral, 90).y, (0.5 - 0.08) / 0.92);
});
test("beta uses shortest angular difference across wrap", () => {
  const value = motionTarget({ beta: -179.5, gamma: 0 }, { beta: 179.5, gamma: 0 }, 90);
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
    const right = motionTarget({ beta: neutral.beta + sign * 20, gamma: neutral.gamma }, neutral, angle);
    const up = motionTarget({ beta: neutral.beta, gamma: neutral.gamma + sign * 20 }, neutral, angle);
    near(right.x, 1); near(right.y, 0);
    near(up.x, 0); near(up.y, 1);
  }
});
test("both portrait sides keep screen directions consistent", () => {
  for (const angle of [0, 180] as const) {
    const sign = angle === 0 ? 1 : -1;
    const right = motionTarget({ beta: neutral.beta, gamma: neutral.gamma + sign * 20 }, neutral, angle);
    const up = motionTarget({ beta: neutral.beta - sign * 20, gamma: neutral.gamma }, neutral, angle);
    near(right.x, 1); near(right.y, 0);
    near(up.x, 0); near(up.y, 1);
  }
});
test("portrait uses shortest beta difference across wrap", () => {
  assert.deepEqual(motionTarget({ beta: -179.5, gamma: 0 }, { beta: 179.5, gamma: 0 }, 0), { x: 0, y: 0 });
});
test("each screen angle is the previous one's mapping rotated a quarter turn", () => {
  // Rotating the screen 90° counterclockwise maps screen vector (x, y) to (-y, x) for the same physical tilt.
  const pose = { beta: neutral.beta + 12, gamma: neutral.gamma + 7 };
  for (const [from, to] of [[0, 90], [90, 180], [180, 270], [270, 0]] as const) {
    const a = motionTarget(pose, neutral, from);
    const b = motionTarget(pose, neutral, to);
    near(b.x, -a.y); near(b.y, a.x);
  }
});
test("screen angles support portrait and both landscape sides, including Safari negative angles", () => {
  for (const angle of [0, 90, 180, 270] as const) assert.equal(screenAngle(angle), angle);
  assert.equal(screenAngle(-90), 270);
  assert.equal(screenAngle(360), 0);
  for (const angle of [45, undefined, NaN, Infinity]) assert.equal(screenAngle(angle), undefined);
});
