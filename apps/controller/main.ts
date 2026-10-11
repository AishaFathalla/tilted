import type { ServerMessage, Vector } from "../../shared/protocol";

import { MOTION, motionTarget, screenAngle, smoothVector, type Pose, type ScreenAngle } from "./motion";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const form = document.querySelector<HTMLFormElement>("#join")!;
const room = document.querySelector<HTMLInputElement>("#room")!;
const name = document.querySelector<HTMLInputElement>("#name")!;
const submit = document.querySelector<HTMLButtonElement>("#submit")!;
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
const controls = document.querySelector<HTMLFieldSetElement>("#controls")!;
const x = document.querySelector<HTMLInputElement>("#x")!;
const y = document.querySelector<HTMLInputElement>("#y")!;
const vector = document.querySelector<HTMLOutputElement>("#vector")!;
const mode = document.querySelector<HTMLSelectElement>("#mode")!;
const enable = document.querySelector<HTMLButtonElement>("#enable-motion")!;
const calibrate = document.querySelector<HTMLButtonElement>("#calibrate")!;
const motionStatus = document.querySelector<HTMLParagraphElement>("#motion-status")!;
const sliders = document.querySelector<HTMLDivElement>("#sliders")!;
let seq = 0;
let listening = false;
let enabling = false;
let latest: Pose | undefined;
let neutral: Pose | undefined;
let calibratedAngle: ScreenAngle | undefined;
let smoothed: Vector = { x: 0, y: 0 };
let sensorTimer: ReturnType<typeof setTimeout> | undefined;
let permissionGeneration = 0;

function sendVector(value: Vector) {
  vector.textContent = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
  if (joined && !roomClosed && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "vec", seq: seq++, ...value }));
  }
}
function resetVector() {
  neutral = undefined;
  calibratedAngle = undefined;
  smoothed = { x: 0, y: 0 };
  x.value = y.value = "0";
  sendVector(smoothed);
}
function currentScreenAngle() {
  // Physical screen orientation, not viewport aspect ratio (keyboard).
  if (screen.orientation) return screenAngle(screen.orientation.angle);
  return screenAngle((window as Window & { orientation?: number }).orientation);
}
function updateMotionUI() {
  const active = mode.value === "motion";
  sliders.hidden = active;
  enable.hidden = calibrate.hidden = !active;
  enable.disabled = listening || enabling;
  calibrate.disabled = !listening || !latest || currentScreenAngle() === undefined || document.hidden;
}
function pauseMotion(message: string) {
  latest = undefined;
  resetVector();
  motionStatus.textContent = message;
  updateMotionUI();
}
function armSensorTimeout() {
  clearTimeout(sensorTimer);
  sensorTimer = setTimeout(() => {
    if (mode.value === "motion" && listening) {
      pauseMotion("No motion readings. Check sensor permissions or use sliders. Recalibrate when readings resume.");
    }
  }, MOTION.sensorTimeoutMs);
}
function onOrientation(event: DeviceOrientationEvent) {
  if (mode.value !== "motion" || !joined || roomClosed || document.hidden) return;
  const angle = currentScreenAngle();
  if (angle === undefined) {
    pauseMotion("Motion paused: unknown screen orientation. Hold the phone steady and recalibrate.");
    return;
  }
  if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) {
    pauseMotion("Motion readings unavailable. Use sliders or wait for readings and recalibrate.");
    return;
  }
  if (neutral && angle !== calibratedAngle) {
    pauseMotion("Screen rotated. Hold your phone steady and recalibrate.");
  }
  armSensorTimeout();
  latest = { beta: event.beta, gamma: event.gamma };
  updateMotionUI();
  if (!neutral) {
    motionStatus.textContent = "Hold a comfortable neutral pose, then tap Calibrate.";
    return;
  }
  smoothed = smoothVector(smoothed, motionTarget(latest, neutral, angle));
  sendVector(smoothed);
}
function stopMotion() {
  permissionGeneration++;
  enabling = false;
  window.removeEventListener("deviceorientation", onOrientation);
  listening = false;
  latest = undefined;
  clearTimeout(sensorTimer);
}
mode.onchange = () => {
  stopMotion();
  resetVector();
  motionStatus.textContent = mode.value === "motion" ? "Tap Enable motion, then calibrate." : "Slider fallback active.";
  updateMotionUI();
};
x.oninput = y.oninput = () => {
  if (mode.value === "sliders") sendVector({ x: Number(x.value), y: Number(y.value) });
};
enable.onclick = async () => {
  resetVector();
  if (!window.isSecureContext) {
    motionStatus.textContent = "Motion requires trusted HTTPS. Use sliders or open the HTTPS URL.";
    return;
  }
  if (typeof DeviceOrientationEvent === "undefined") {
    motionStatus.textContent = "Motion sensors unsupported. Use sliders.";
    return;
  }
  const generation = ++permissionGeneration;
  enabling = true;
  updateMotionUI();
  try {
    const api = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    const permission = api.requestPermission ? await api.requestPermission() : "granted";
    if (generation !== permissionGeneration) return;
    if (permission !== "granted") {
      motionStatus.textContent = "Motion permission denied. Allow it in browser settings or use sliders.";
      return;
    }
    listening = true;
    window.addEventListener("deviceorientation", onOrientation);
    motionStatus.textContent = currentScreenAngle() !== undefined ? "Waiting for motion readings…" : "Unknown screen orientation. Hold the phone steady and recalibrate.";
    armSensorTimeout();
  } catch {
    if (generation === permissionGeneration) motionStatus.textContent = "Could not enable motion. Check browser permissions or use sliders.";
  } finally {
    if (generation === permissionGeneration) { enabling = false; updateMotionUI(); }
  }
};
calibrate.onclick = () => {
  if (!latest || currentScreenAngle() === undefined || document.hidden) return;
  resetVector();
  neutral = { ...latest };
  calibratedAngle = currentScreenAngle();
  motionStatus.textContent = "Calibrated. Screen’s right edge down = +X; screen’s top edge down/away = +Y.";
};
function orientationChanged() {
  if (mode.value === "motion") pauseMotion("Screen rotated. Hold your phone steady and recalibrate.");
}
screen.orientation?.addEventListener("change", orientationChanged);
window.addEventListener("orientationchange", orientationChanged);
document.addEventListener("visibilitychange", () => {
  if (mode.value === "motion") {
    clearTimeout(sensorTimer);
    pauseMotion("Motion paused while the page was hidden. Recalibrate to resume.");
    if (!document.hidden && listening) armSensorTimeout();
  }
});
updateMotionUI();
let joined = false;
let roomClosed = false;
socket.onopen = () => { status.textContent = "Connected. Enter the host’s room code."; submit.disabled = false; };
form.onsubmit = (event) => {
  event.preventDefault();
  submit.disabled = true;
  socket.send(JSON.stringify({ type: "join", room: room.value.trim(), name: name.value.trim() }));
};
socket.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);
  if (message.type === "joined") {
    joined = true;
    form.hidden = true;
    controls.hidden = false;
    controls.disabled = false;
    status.textContent = `Joined room ${message.room} as ${name.value.trim()}.`;
  } else if (message.type === "error") {
    status.textContent = message.message;
    submit.disabled = joined;
  } else if (message.type === "room_closed") {
    roomClosed = true;
    stopMotion();
    resetVector();
    controls.disabled = true;
    status.textContent = "Host closed the room. Reload to join a new room.";
    submit.disabled = true;
  }
};
socket.onclose = () => {
  stopMotion();
  resetVector();
  controls.disabled = true;
  if (!roomClosed) status.textContent = "Connection closed. Reload to join again.";
  submit.disabled = true;
};
socket.onerror = () => { status.textContent = "Connection error. Check that the room server is running."; };
