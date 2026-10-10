export type Cell = { col: number; row: number };

/** Center-based rectangle, matching Matter.Bodies.rectangle(x, y, width, height). */
export type Rect = { x: number; y: number; width: number; height: number };

export type Maze = {
  cols: number;
  rows: number;
  seed: number;
  /** east[row * cols + col]: wall on the cell's east side. The last column is always the border. */
  east: boolean[];
  /** south[row * cols + col]: wall on the cell's south side. The last row is always the border. */
  south: boolean[];
  start: Cell;
  /** The cell farthest from start along the maze's only path. */
  goal: Cell;
};

/** Small seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Perfect maze (exactly one path between any two cells) via iterative recursive backtracking. */
export function generateMaze(cols: number, rows: number, seed = Date.now()): Maze {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
    throw new RangeError("Maze dimensions must be positive integers.");
  }
  const random = mulberry32(seed);
  const count = cols * rows;
  const east = new Array<boolean>(count).fill(true);
  const south = new Array<boolean>(count).fill(true);
  const visited = new Uint8Array(count);
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const col = cell % cols;
    // Each option records which wall to remove; comparing indices fails when cols === 1.
    const options: { next: number; walls: boolean[]; wall: number }[] = [];
    if (col > 0 && !visited[cell - 1]) options.push({ next: cell - 1, walls: east, wall: cell - 1 });
    if (col < cols - 1 && !visited[cell + 1]) options.push({ next: cell + 1, walls: east, wall: cell });
    if (cell >= cols && !visited[cell - cols]) options.push({ next: cell - cols, walls: south, wall: cell - cols });
    if (cell + cols < count && !visited[cell + cols]) options.push({ next: cell + cols, walls: south, wall: cell });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const { next, walls, wall } = options[Math.floor(random() * options.length)];
    walls[wall] = false;
    visited[next] = 1;
    stack.push(next);
  }
  const maze: Maze = { cols, rows, seed, east, south, start: { col: 0, row: 0 }, goal: { col: 0, row: 0 } };
  const distance = distancesFrom(maze, maze.start);
  let farthest = 0;
  for (let cell = 1; cell < count; cell++) if (distance[cell] > distance[farthest]) farthest = cell;
  maze.goal = { col: farthest % cols, row: Math.floor(farthest / cols) };
  return maze;
}

/** Cells reachable from `cell` in one step (no wall in between). */
export function openNeighbors(maze: Maze, { col, row }: Cell): Cell[] {
  const { cols, rows, east, south } = maze;
  const index = row * cols + col;
  const result: Cell[] = [];
  if (col > 0 && !east[index - 1]) result.push({ col: col - 1, row });
  if (col < cols - 1 && !east[index]) result.push({ col: col + 1, row });
  if (row > 0 && !south[index - cols]) result.push({ col, row: row - 1 });
  if (row < rows - 1 && !south[index]) result.push({ col, row: row + 1 });
  return result;
}

/** Path length from `from` to every cell, indexed by row * cols + col; -1 if unreachable. */
export function distancesFrom(maze: Maze, from: Cell): Int32Array {
  const distance = new Int32Array(maze.cols * maze.rows).fill(-1);
  distance[from.row * maze.cols + from.col] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const step = distance[cell.row * maze.cols + cell.col] + 1;
    for (const next of openNeighbors(maze, cell)) {
      const index = next.row * maze.cols + next.col;
      if (distance[index] === -1) {
        distance[index] = step;
        queue.push(next);
      }
    }
  }
  return distance;
}

/** World-space center of a cell. World Y increases downward (canvas/Matter.js convention). */
export function cellCenter({ col, row }: Cell, cellSize: number) {
  return { x: (col + 0.5) * cellSize, y: (row + 0.5) * cellSize };
}

/**
 * Wall rectangles in world space, with collinear wall runs merged to keep physics body counts low.
 * The maze spans (0, 0) to (cols * cellSize, rows * cellSize); walls are centered on grid lines and
 * extend thickness / 2 past each end so corners are closed.
 */
export function wallRects(maze: Maze, cellSize: number, thickness: number): Rect[] {
  const { cols, rows, east, south } = maze;
  const rects: Rect[] = [];
  const addRuns = (length: number, hasWall: (i: number) => boolean, toRect: (start: number, end: number) => Rect) => {
    let start = -1;
    for (let i = 0; i <= length; i++) {
      if (i < length && hasWall(i)) {
        if (start === -1) start = i;
      } else if (start !== -1) {
        rects.push(toRect(start, i));
        start = -1;
      }
    }
  };
  for (let line = 0; line <= rows; line++) {
    addRuns(cols, (col) => line === 0 || south[(line - 1) * cols + col], (start, end) => ({
      x: ((start + end) / 2) * cellSize,
      y: line * cellSize,
      width: (end - start) * cellSize + thickness,
      height: thickness,
    }));
  }
  for (let line = 0; line <= cols; line++) {
    addRuns(rows, (row) => line === 0 || east[row * cols + line - 1], (start, end) => ({
      x: line * cellSize,
      y: ((start + end) / 2) * cellSize,
      width: thickness,
      height: (end - start) * cellSize + thickness,
    }));
  }
  return rects;
}
