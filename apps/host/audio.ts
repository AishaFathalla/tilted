/** Small synthesized cues: no downloads, and audio is enabled by a host gesture. */
export function createGameAudio() {
  let context: AudioContext | undefined;
  let bus: GainNode | undefined;
  let enabled = true;
  let lastImpact = -Infinity;
  let lastTick: number | undefined;
  let started = false;
  const voices = new Set<OscillatorNode>();
  function stopCues() {
    for (const voice of voices) voice.stop();
    voices.clear();
  }

  function unlock() {
    try {
      context ??= new AudioContext();
      if (!bus) {
        bus = context.createGain();
        bus.gain.value = enabled ? 1 : 0;
        bus.connect(context.destination);
      }
      void context.resume().catch(() => {});
    } catch { /* Gameplay remains available without audio. */ }
  }
  function tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = "sine", endFrequency = frequency) {
    if (!enabled || !context || !bus || context.state !== "running") return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(bus);
    oscillator.start(now);
    voices.add(oscillator);
    oscillator.stop(now + duration + .01);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  }
  return {
    unlock,
    setEnabled(value: boolean) {
      enabled = value;
      if (bus && context) bus.gain.setValueAtTime(value ? 1 : 0, context.currentTime);
      if (value) unlock();
    },
    reset() { stopCues(); started = false; lastTick = undefined; lastImpact = -Infinity; },
    tick(remaining: number, running: boolean) {
      if (running && !started) {
        started = true;
        [392, 523, 784].forEach((frequency, i) => tone(frequency, .16, .09, i * .11));
      }
      const seconds = Math.ceil(remaining);
      if (!running || seconds <= 0 || seconds > 10 || seconds === lastTick) return;
      lastTick = seconds;
      tone(seconds <= 3 ? 1100 : 850, .045, .07, 0, "triangle");
      if (seconds <= 3) tone(1100, .045, .055, .5, "triangle");
    },
    impact(speed: number) {
      if (speed < .8 || performance.now() - lastImpact < 110) return;
      lastImpact = performance.now();
      tone(190 + Math.min(speed, 8) * 18, .085, Math.min(.12, speed * .018), 0, "sine", 75);
    },
    finish(won: boolean) {
      stopCues();
      const notes = won ? [523, 659, 784, 1047] : [330, 277, 220];
      notes.forEach((frequency, i) => tone(frequency, won ? .3 : .35, .09, i * .13, "triangle"));
    },
  };
}
