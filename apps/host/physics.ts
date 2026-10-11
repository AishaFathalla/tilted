import Matter from "matter-js";
import type { Vector } from "../../shared/protocol";
import { BALL_RADIUS, CELL_SIZE, WALL_THICKNESS } from "./dimensions";
import { cellCenter, wallRects, type Maze } from "./maze";
const { Bodies, Body, Composite, Engine, Events } = Matter;

/** Fixed physics step; Matter.js behaves consistently only with a constant delta. */
export const STEP_MS = 1000 / 60;
/**
 * Matter.js gravity magnitude at full tilt (1 = Matter's default "full screen" gravity). Gravity scales
 * linearly with the tilt vector, so ball speed does too; raise this (or lower ROLLING_RESISTANCE) to go faster.
 */
const GRAVITY = 0.9;
/** Matter frictionAir: velocity lost per step; balances acceleration and braking. */
const ROLLING_RESISTANCE = 0.04;
/**
 * Hard speed cap in world units per step. Matter only checks collisions once per step, so the ball must
 * never move more than BALL_RADIUS + WALL_THICKNESS / 2 (15) in one step or it can tunnel through a wall.
 */
const MAX_SPEED = 8;

/** 2D simulation in maze world coordinates (x right, y down), matching wallRects and cellCenter. */
export function createMazePhysics(maze: Maze, onImpact?: (speed: number) => void) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const walls = wallRects(maze, CELL_SIZE, WALL_THICKNESS).map((rect) =>
    Bodies.rectangle(rect.x, rect.y, rect.width, rect.height, { isStatic: true, friction: 0, restitution: 0.3 }));
  const start = cellCenter(maze.start, CELL_SIZE);
  const ball = Bodies.circle(start.x, start.y, BALL_RADIUS, {
    friction: 0,
    frictionStatic: 0,
    frictionAir: ROLLING_RESISTANCE,
    restitution: 0.3,
  });
  Composite.add(engine.world, [...walls, ball]);
  let incomingSpeed = 0;
  if (onImpact) Events.on(engine, "collisionStart", (event) => {
    if (event.pairs.some((pair) => pair.bodyA === ball || pair.bodyB === ball)) onImpact(incomingSpeed);
  });

  return {
    /** Ball center in maze world coordinates. */
    get ball() {
      return { x: ball.position.x, y: ball.position.y };
    },
    /** Advances one STEP_MS with the board tilted by `tilt` (control space: +y is north, i.e. world -y). */
    step(tilt: Vector, accelerationBoost = 1) {
      engine.gravity.x = tilt.x * GRAVITY * accelerationBoost;
      engine.gravity.y = -tilt.y * GRAVITY * accelerationBoost;
      if (Body.getSpeed(ball) > MAX_SPEED) Body.setSpeed(ball, MAX_SPEED);
      incomingSpeed = Body.getSpeed(ball);
      Engine.update(engine, STEP_MS);
      if (Body.getSpeed(ball) > MAX_SPEED) Body.setSpeed(ball, MAX_SPEED);
    },
  };
}
