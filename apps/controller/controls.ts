import type { Vector } from "../../shared/protocol";
import { MOTION, motionTarget, screenAngle, smoothVector, type Pose, type ScreenAngle } from "./motion";

// Reuse the controller's sensor flow on the combined lobby page.
export function mountMotionControls(sendVector: (value: Vector) => void, isActive: () => boolean) {
  const x = document.querySelector<HTMLInputElement>("#x")!;
  const y = document.querySelector<HTMLInputElement>("#y")!;
  const mode = document.querySelector<HTMLSelectElement>("#mode")!;
  const enable = document.querySelector<HTMLButtonElement>("#enable-motion")!;
  const calibrate = document.querySelector<HTMLButtonElement>("#calibrate")!;
  const motionStatus = document.querySelector<HTMLParagraphElement>("#motion-status")!;
  const sliders = document.querySelector<HTMLDivElement>("#sliders")!;
  let listening = false;
  let enabling = false;
  let latest: Pose | undefined;
  let neutral: Pose | undefined;
  let calibratedAngle: ScreenAngle | undefined;
  let smoothed: Vector = { x: 0, y: 0 };
  let sensorTimer: ReturnType<typeof setTimeout> | undefined;
  let permissionGeneration = 0;

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
    if (mode.value !== "motion" || !isActive() || document.hidden) return;
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

  return { stop() { stopMotion(); resetVector(); updateMotionUI(); } };
}
