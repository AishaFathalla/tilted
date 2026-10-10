import { cellCenter, wallRects, type Maze } from "./maze";

// World units; physics should reuse these so drawn walls match collision walls.
export const CELL_SIZE = 40;
export const WALL_THICKNESS = 6;
export const BALL_RADIUS = CELL_SIZE * 0.3;

/** Draws walls, goal, and the ball at the start cell. Canvas CSS should set max-width: 100%; height: auto to shrink on narrow screens. */
export function drawMaze(canvas: HTMLCanvasElement, maze: Maze) {
  // Outer walls stick out WALL_THICKNESS / 2 past the maze, so pad the canvas by that on each side.
  const width = maze.cols * CELL_SIZE + WALL_THICKNESS;
  const height = maze.rows * CELL_SIZE + WALL_THICKNESS;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`; // CSS size in world units, not device pixels
  const context = canvas.getContext("2d")!;
  context.setTransform(ratio, 0, 0, ratio, (WALL_THICKNESS / 2) * ratio, (WALL_THICKNESS / 2) * ratio);
  context.clearRect(-WALL_THICKNESS / 2, -WALL_THICKNESS / 2, width, height);

  const goal = cellCenter(maze.goal, CELL_SIZE);
  context.fillStyle = "#2a9d8f";
  context.fillRect(goal.x - CELL_SIZE * 0.35, goal.y - CELL_SIZE * 0.35, CELL_SIZE * 0.7, CELL_SIZE * 0.7);

  context.fillStyle = "#222";
  for (const wall of wallRects(maze, CELL_SIZE, WALL_THICKNESS)) {
    context.fillRect(wall.x - wall.width / 2, wall.y - wall.height / 2, wall.width, wall.height);
  }

  const ball = cellCenter(maze.start, CELL_SIZE);
  context.fillStyle = "#e76f51";
  context.beginPath();
  context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  context.fill();
}
