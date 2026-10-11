import assert from "node:assert/strict";
import { test } from "node:test";
import { createGameAudio } from "../apps/host/audio";
import { createMazePhysics } from "../apps/host/physics";
import { generateMaze } from "../apps/host/maze";

test("audio ticks once per second, accelerates at three seconds, and respects mute", (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
  const starts: number[] = [];
  let stops = 0;
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class Context {
    currentTime = 0;
    state = "running";
    destination = {};
    async resume() {}
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() {
      return { frequency: parameter(), connect() {}, disconnect() {}, start(time: number) { starts.push(time); }, stop() { stops++; } };
    }
  }
  Object.defineProperty(globalThis, "AudioContext", { value: Context, configurable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "AudioContext", original);
    else Reflect.deleteProperty(globalThis, "AudioContext");
  });
  const audio = createGameAudio();
  audio.unlock();
  audio.tick(180, false);
  assert.equal(starts.length, 0);
  audio.tick(179, true);
  assert.equal(starts.length, 3);
  audio.tick(179, true);
  assert.equal(starts.length, 3);
  audio.tick(9.9, true);
  audio.tick(9.8, true);
  assert.equal(starts.length, 4);
  audio.tick(2.9, true);
  assert.deepEqual(starts.slice(-2), [0, .5]);
  audio.setEnabled(false);
  audio.tick(1.9, true);
  audio.impact(8);
  audio.finish(true);
  assert.equal(starts.length, 6);
  audio.setEnabled(true);
  audio.reset();
  audio.tick(179, true);
  assert.equal(starts.length, 9);
  audio.impact(.2);
  assert.equal(starts.length, 9);
  audio.impact(8);
  audio.impact(8);
  assert.equal(starts.length, 10);
  const beforeReset = stops;
  audio.reset();
  assert.ok(stops > beforeReset);
});

test("wall impacts report movement speed and do not fire for neutral input", () => {
  const impacts: number[] = [];
  const physics = createMazePhysics(generateMaze(1, 1, 42), (speed) => impacts.push(speed));
  for (let i = 0; i < 30; i++) physics.step({ x: 0, y: 0 });
  assert.equal(impacts.length, 0);
  for (let i = 0; i < 90; i++) physics.step({ x: 1, y: 0 });
  assert.ok(impacts.some((speed) => speed > .8));
  assert.ok(impacts.every(Number.isFinite));
});
