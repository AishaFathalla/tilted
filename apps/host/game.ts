import type { Vector } from "../../shared/protocol";
import { CELL_SIZE } from "./dimensions";
import { createMazeView } from "./draw";
import { cellCenter, type Maze } from "./maze";
import { createMazePhysics, STEP_MS } from "./physics";
import { createRound } from "./round";
import { teamworkBoost } from "./teamwork";
import type { PlayerInput } from "./player-vectors";

const TILT_EASING = 0.15; // fraction of the remaining tilt applied per physics step
const GOAL_RADIUS = CELL_SIZE * 0.35; // matches the drawn goal disc
const MAX_CATCH_UP_MS = 250; // after a stalled tab, skip ahead instead of simulating every missed step

/**
 * Runs the maze: eases the board toward the team vector, steps physics at a fixed rate with that same
 * eased tilt (so the ball rolls the way the board visibly leans), and reports when the goal is reached.
 */
export function createGame(canvas: HTMLCanvasElement, onSolved: (seconds: number) => void, options?: {
  durationSeconds?: number;
  requireReady?: boolean;
  onTick: (remaining: number, started: boolean) => void;
  onLost: () => void;
  onImpact?: (speed: number) => void;
}) {
  const view = createMazeView(canvas);
  const target = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  let physics: ReturnType<typeof createMazePhysics> | undefined;
  let goal = { x: 0, y: 0 };
  let steps = 0; // counted from the first non-neutral team vector
  let solved = false;
  const round = options ? createRound(options.durationSeconds ?? 120) : undefined;
  let frameTime = performance.now();
  let boostTarget = 1;
  let boost = 1;
  let ready = !options?.requireReady;
  let started = false;

  function step() {
    if (!started && options?.requireReady) return;
    tilt.x += (target.x - tilt.x) * TILT_EASING;
    tilt.y += (target.y - tilt.y) * TILT_EASING;
    boost += (boostTarget - boost) * TILT_EASING;
    if (!physics || solved) return;
    if (steps === 0 && !target.x && !target.y) return;
    physics.step(tilt, boost);
    steps++;
    const ball = physics.ball;
    if (Math.hypot(ball.x - goal.x, ball.y - goal.y) < GOAL_RADIUS) {
      solved = true;
      const result = round?.win(frameTime);
      if (!result || result.state === "won") onSolved(result?.elapsed ?? (steps * STEP_MS) / 1000);
    }
  }

  let last = performance.now();
  let pending = 0;
  function frame(now: number) {
    frameTime = now;
    if (physics && round && !solved) {
      const result = round.advance(now, options?.requireReady ? ready : Boolean(target.x || target.y));
      started = result.state !== "waiting";
      options!.onTick(result.remaining, result.state !== "waiting");
      if (result.state === "lost") { solved = true; options!.onLost(); }
    }
    pending = Math.min(pending + now - last, MAX_CATCH_UP_MS);
    last = now;
    for (; pending >= STEP_MS; pending -= STEP_MS) step();
    view.setTilt(tilt);
    if (physics) view.setBall(physics.ball.x, physics.ball.y);
    view.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setReady(value: boolean) { ready = value; },
    setPlayerVectors(players: PlayerInput[]) {
      view.setPlayerVectors(players);
      boostTarget = teamworkBoost(players.map((player) => player.vector));
    },
    setMaze(maze: Maze) {
      physics = createMazePhysics(maze, options?.onImpact);
      goal = cellCenter(maze.goal, CELL_SIZE);
      steps = 0;
      solved = false;
      started = false;
      ready = !options?.requireReady;
      tilt.x = tilt.y = 0;
      boost = 1;
      pending = 0;
      last = performance.now();
      round?.reset();
      options?.onTick(options.durationSeconds ?? 120, false);
      view.setMaze(maze);
    },
    /** Team vector, components in [-1, 1]. */
    setTeamVector(vector: Vector) {
      target.x = vector.x;
      target.y = vector.y;
    },
    stop() { solved = true; round?.stop(); target.x = target.y = 0; },
  };
}
