export type RoundState = "waiting" | "running" | "won" | "lost" | "stopped";

// Use wall time, so a hidden or stalled host tab cannot extend the round.
export function createRound(durationSeconds = 120) {
  let state: RoundState = "waiting";
  let startedAt = 0;
  let elapsed = 0;
  const snapshot = () => ({ state, elapsed, remaining: Math.max(0, durationSeconds - elapsed) });
  return {
    reset() { state = "waiting"; startedAt = 0; elapsed = 0; return snapshot(); },
    advance(now: number, hasInput: boolean) {
      if (state === "waiting" && hasInput) { startedAt = now; state = "running"; }
      if (state === "running") {
        elapsed = Math.min(durationSeconds, Math.max(0, (now - startedAt) / 1000));
        if (elapsed >= durationSeconds) state = "lost";
      }
      return snapshot();
    },
    win(now: number) {
      this.advance(now, false);
      if (state === "running") state = "won";
      return snapshot();
    },
    stop() { state = "stopped"; },
  };
}
