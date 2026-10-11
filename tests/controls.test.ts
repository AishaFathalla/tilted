import assert from "node:assert/strict";
import { test } from "node:test";
import { mountMotionControls } from "../apps/controller/controls";

test("motion streams before manual calibration, which immediately zeros the current pose", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const elements = new Map<string, any>();
  for (const id of ["x", "y", "mode", "enable-motion", "calibrate", "recalibrate", "vector", "motion-status", "sliders"]) {
    elements.set(`#${id}`, {
      value: id === "mode" ? "motion" : "0", textContent: "", hidden: false, disabled: false,
      replaceChildren(child: any) { this.textContent = child.textContent; }, animate() {},
    });
  }
  let orientation: ((event: any) => void) | undefined;
  const globals = {
    document: { hidden: false, querySelector: (id: string) => elements.get(id), createElement: () => ({ textContent: "" }), addEventListener() {} },
    window: { isSecureContext: true, addEventListener(type: string, listener: any) { if (type === "deviceorientation") orientation = listener; }, removeEventListener() {} },
    screen: { orientation: { angle: 90, addEventListener() {} } },
    DeviceOrientationEvent: class {},
  };
  for (const [key, value] of Object.entries(globals)) {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true });
  }
  let controls: ReturnType<typeof mountMotionControls> | undefined;
  t.after(() => {
    controls?.stop();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const vectors: { x: number; y: number }[] = [];
  let readyRequests = 0;
  let unreadyRequests = 0;
  controls = mountMotionControls((vector, show = true) => {
    vectors.push({ ...vector });
    if (show) elements.get("#vector").textContent = `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)})`;
  }, () => true, () => readyRequests++, () => unreadyRequests++);
  await elements.get("#enable-motion").onclick();
  orientation!({ beta: 15, gamma: 10 });
  assert.notEqual(elements.get("#motion-status").textContent, "Calibrated!");
  assert.notEqual(elements.get("#vector").textContent, "(0.00, 0.00)");
  assert.deepEqual(vectors.at(-1), { x: 0, y: 0 });
  elements.get("#calibrate").onclick();
  assert.equal(elements.get("#motion-status").textContent, "Calibrated!");
  assert.deepEqual(vectors.at(-1), { x: 0, y: 0 });
  assert.equal(elements.get("#calibrate").disabled, false);
  assert.equal(elements.get("#calibrate").textContent, "Re-calibrate");
  assert.equal(readyRequests, 1);
  orientation!({ beta: 15, gamma: 10 });
  assert.deepEqual(vectors.at(-1), { x: 0, y: 0 });
  orientation!({ beta: 30, gamma: 10 });
  assert.ok(vectors.at(-1)!.x > 0);
  assert.equal(elements.get("#vector").textContent, "(0.00, 0.00)");
  // Auto-rotation must preserve the saved landscape movement frame, even when
  // the browser does not expose native orientation locking.
  globals.screen.orientation.angle = 0;
  orientation!({ beta: 30, gamma: 10 });
  assert.ok(vectors.at(-1)!.x > 0);
  assert.equal(vectors.at(-1)!.y, 0);
  assert.equal(readyRequests, 1);
  globals.screen.orientation.angle = 270;
  orientation!({ beta: 30, gamma: 10 });
  assert.ok(vectors.at(-1)!.x > 0);
  assert.equal(vectors.at(-1)!.y, 0);
  t.mock.timers.tick(2001);
  assert.equal(elements.get("#motion-status").textContent, "Calibrated!");
  assert.equal(elements.get("#calibrate").textContent, "Re-calibrate");
  assert.deepEqual(vectors.at(-1), { x: 0, y: 0 });
  orientation!({ beta: null, gamma: null });
  assert.equal(elements.get("#motion-status").textContent, "Calibrated!");
  elements.get("#calibrate").onclick();
  assert.equal(readyRequests, 1);
  assert.equal(unreadyRequests, 1);
  assert.equal(elements.get("#calibrate").textContent, "Calibrate");
  assert.equal(elements.get("#calibrate").disabled, false);
  t.mock.timers.tick(2001);
  assert.equal(elements.get("#motion-status").textContent, "No motion readings. Try sliders.");
  orientation!({ beta: 30, gamma: 10 });
  const lockRequests: string[] = [];
  let unlockRequests = 0;
  let fullscreenRequests = 0;
  Object.assign(globals.document, {
    documentElement: { async requestFullscreen() { fullscreenRequests++; } },
  });
  Object.assign(globals.screen.orientation, {
    type: "landscape-secondary",
    async lock(value: string) { lockRequests.push(value); },
    unlock() { unlockRequests++; },
  });
  elements.get("#calibrate").onclick();
  await Promise.resolve();
  assert.deepEqual(lockRequests, ["landscape-secondary"]);
  assert.equal(fullscreenRequests, 1);
  assert.equal(readyRequests, 2);
  assert.equal(elements.get("#motion-status").textContent, "Calibrated!");
  orientation!({ beta: 30, gamma: 10 });
  assert.deepEqual(vectors.at(-1), { x: 0, y: 0 });
  elements.get("#calibrate").onclick();
  assert.equal(unlockRequests, 1);
});
