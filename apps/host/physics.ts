import { Bodies, Composite, Engine } from "matter-js";
import type { Vector } from "../../shared/protocol";
import { BALL_RADIUS, CELL_SIZE, WALL_THICKNESS } from "./dimensions";
import { cellCenter, wallRects, type Maze } from "./maze";

/** Fixed physics step; Matter.js behaves consistently only with a constant delta. */
export const STEP_MS = 1000 / 60;
/** Matter.js gravity magnitude at full tilt (1 = Matter's default "full screen" gravity). */
const GRAVITY = 0.25;

/** 2D simulation in maze world coordinates (x right, y down), matching wallRects and cellCenter. */
export function createMazePhysics(maze: Maze) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const walls = wallRects(maze, CELL_SIZE, WALL_THICKNESS).map((rect) =>
    Bodies.rectangle(rect.x, rect.y, rect.width, rect.height, { isStatic: true, friction: 0, restitution: 0.3 }));
  const start = cellCenter(maze.start, CELL_SIZE);
  const ball = Bodies.circle(start.x, start.y, BALL_RADIUS, {
    friction: 0,
    frictionStatic: 0,
    frictionAir: 0.03, // rolling resistance; also caps speed at roughly 3.5 cells per second
    restitution: 0.3,
  });
  Composite.add(engine.world, [...walls, ball]);

  return {
    /** Ball center in maze world coordinates. */
    get ball() {
      return { x: ball.position.x, y: ball.position.y };
    },
    /** Advances one STEP_MS with the board tilted by `tilt` (control space: +y is north, i.e. world -y). */
    step(tilt: Vector) {
      engine.gravity.x = tilt.x * GRAVITY;
      engine.gravity.y = -tilt.y * GRAVITY;
      Engine.update(engine, STEP_MS);
    },
  };
}
