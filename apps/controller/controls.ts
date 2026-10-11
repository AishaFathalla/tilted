import type { Vector } from "../../shared/protocol";
import { calibrationFeedback } from "./calibration-feedback";
import { MOTION, motionTarget, screenAngle, smoothVector, type Pose, type ScreenAngle } from "./motion";

// Reuse the controller's sensor flow on the combined lobby page.
export function mountMotionControls(sendVector: (value: Vector, showCoordinates?: boolean) => void, isActive: () => boolean, onCalibrated: () => void = () => {}, onRecalibrating: () => void = () => {}) {
  const x = document.querySelector<HTMLInputElement>("#x")!;
  const y = document.querySelector<HTMLInputElement>("#y")!;
  const mode = document.querySelector<HTMLSelectElement>("#mode")!;
  const enable = document.querySelector<HTMLButtonElement>("#enable-motion")!;
  const calibrate = document.querySelector<HTMLButtonElement>("#calibrate")!;
  const coordinates = document.querySelector<HTMLOutputElement>("#vector")!;
  const motionStatus = document.querySelector<HTMLParagraphElement>("#motion-status")!;
  const sliders = document.querySelector<HTMLDivElement>("#sliders")!;
  const confirmation = calibrationFeedback(calibrate, motionStatus);
  let listening = false;
  let enabling = false;
  let latest: Pose | undefined;
  let neutral: Pose | undefined;
  let calibratedAngle: ScreenAngle | undefined;
  let smoothed: Vector = { x: 0, y: 0 };
  let sensorTimer: ReturnType<typeof setTimeout> | undefined;
  let permissionGeneration = 0;
  let lockGeneration = 0;
  let ownsOrientationLock = false;
  const orientationAPI = screen.orientation as (ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  }) | undefined;

  async function lockOrientation() {
    if (!orientationAPI?.lock) return;
    const generation = lockGeneration;
    // Capture the exact side before entering fullscreen, which may rotate the screen.
    const chosenOrientation = orientationAPI.type;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (generation !== lockGeneration || !neutral) return;
      ownsOrientationLock = true;
      await orientationAPI.lock(chosenOrientation);
    } catch {
      // Browsers may reject locking. The saved sensor frame still keeps play stable.
    }
  }

  function resetVector() {
    lockGeneration++;
    if (ownsOrientationLock) {
      orientationAPI?.unlock();
      ownsOrientationLock = false;
    }
    confirmation.reset();
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
    calibrate.disabled = !neutral && (!listening || !latest || currentScreenAngle() === undefined || document.hidden);
    calibrate.textContent = neutral ? "Re-calibrate" : "Calibrate";
  }
  function pauseMotion(message: string) {
    if (neutral) {
      // Preserve calibration and quietly stop stale input until readings resume.
      smoothed = { x: 0, y: 0 };
      sendVector(smoothed, false);
      return;
    }
    latest = undefined;
    resetVector();
    motionStatus.textContent = message;
    updateMotionUI();
  }
  function armSensorTimeout() {
    clearTimeout(sensorTimer);
    sensorTimer = setTimeout(() => {
      if (mode.value === "motion" && listening) {
        pauseMotion("No motion readings. Try sliders.");
      }
    }, MOTION.sensorTimeoutMs);
  }
  function onOrientation(event: DeviceOrientationEvent) {
    if (mode.value !== "motion" || !isActive() || document.hidden) return;
    const angle = calibratedAngle ?? currentScreenAngle();
    if (angle === undefined) {
      pauseMotion("Motion paused: unknown screen orientation. Hold the phone steady and recalibrate.");
      return;
    }
    if (event.beta === null || event.gamma === null || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) {
      pauseMotion("Motion readings unavailable. Use sliders or wait for readings and recalibrate.");
      return;
    }
    armSensorTimeout();
    latest = { beta: event.beta, gamma: event.gamma };
    updateMotionUI();
    if (!neutral) {
      motionStatus.textContent = "Hold steady, then calibrate.";
    }
    smoothed = smoothVector(smoothed, motionTarget(latest, neutral ?? { beta: 0, gamma: 0 }, angle));
    if (neutral) {
      // Keep the saved zero visible; gameplay still receives live relative tilt.
      sendVector(smoothed, false);
    } else {
      coordinates.textContent = `(${smoothed.x.toFixed(2)}, ${smoothed.y.toFixed(2)})`;
      sendVector({ x: 0, y: 0 }, false);
    }
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
    motionStatus.textContent = mode.value === "motion" ? "Enable motion to begin." : "Sliders on.";
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
      motionStatus.textContent = "Move your phone, then calibrate.";
      armSensorTimeout();
    } catch {
      if (generation === permissionGeneration) motionStatus.textContent = "Could not enable motion. Check browser permissions or use sliders.";
    } finally {
      if (generation === permissionGeneration) { enabling = false; updateMotionUI(); }
    }
  };
  function saveCalibration() {
    if (neutral || !latest || currentScreenAngle() === undefined || document.hidden) return;
    resetVector();
    neutral = { ...latest };
    calibratedAngle = currentScreenAngle();
    void lockOrientation();
    confirmation.show();
    updateMotionUI();
    onCalibrated();
  }
  calibrate.onclick = () => {
    if (neutral) {
      onRecalibrating();
      resetVector();
      motionStatus.textContent = "Hold steady, then calibrate.";
      armSensorTimeout();
      updateMotionUI();
    } else {
      saveCalibration();
    }
  };
  function orientationChanged() {
    if (mode.value === "motion" && !neutral) pauseMotion("Screen rotated. Hold your phone steady and calibrate.");
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
