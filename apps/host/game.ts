import type { Vector } from "../../shared/protocol";
import { CELL_SIZE } from "./dimensions";
import { createMazeView } from "./draw";
import { cellCenter, type Maze } from "./maze";
import { createMazePhysics, STEP_MS } from "./physics";

const TILT_EASING = 0.15; // fraction of the remaining tilt applied per physics step
const GOAL_RADIUS = CELL_SIZE * 0.35; // matches the drawn goal disc
const MAX_CATCH_UP_MS = 250; // after a stalled tab, skip ahead instead of simulating every missed step

/**
 * Runs the maze: eases the board toward the team vector, steps physics at a fixed rate with that same
 * eased tilt (so the ball rolls the way the board visibly leans), and reports when the goal is reached.
 */
export function createGame(canvas: HTMLCanvasElement, onSolved: (seconds: number) => void) {
  const view = createMazeView(canvas);
  const target = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  let physics: ReturnType<typeof createMazePhysics> | undefined;
  let goal = { x: 0, y: 0 };
  let steps = 0; // counted from the first non-neutral team vector
  let solved = false;

  function step() {
    tilt.x += (target.x - tilt.x) * TILT_EASING;
    tilt.y += (target.y - tilt.y) * TILT_EASING;
    if (!physics || solved) return;
    if (steps === 0 && !target.x && !target.y) return;
    physics.step(tilt);
    steps++;
    const ball = physics.ball;
    if (Math.hypot(ball.x - goal.x, ball.y - goal.y) < GOAL_RADIUS) {
      solved = true;
      onSolved((steps * STEP_MS) / 1000);
    }
  }

  let last = performance.now();
  let pending = 0;
  function frame(now: number) {
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
    setMaze(maze: Maze) {
      physics = createMazePhysics(maze);
      goal = cellCenter(maze.goal, CELL_SIZE);
      steps = 0;
      solved = false;
      view.setMaze(maze);
    },
    /** Team vector, components in [-1, 1]. */
    setTeamVector(vector: Vector) {
      target.x = vector.x;
      target.y = vector.y;
    },
  };
}
