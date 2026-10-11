import * as THREE from "three";
import type { Vector } from "../../shared/protocol";
import { BALL_RADIUS, CELL_SIZE, WALL_HEIGHT, WALL_THICKNESS } from "./dimensions";
import { cellCenter, wallRects, type Maze } from "./maze";
import { createPlayerVectors } from "./player-vectors";

const MAX_TILT = 0.35; // radians (~20°) at a full-strength tilt; visual only, ball speed is set in physics.ts
const CAMERA_ANGLE = 0.55; // radians from straight overhead, looking north

/**
 * 3D view of a maze on a tilting board. Maze world coordinates (x right, y down) map to the board's
 * x and z, with Three.js y as height. The canvas's CSS decides its size; the view follows resizes.
 * Draws only when render() is called, so the game loop controls timing.
 */
export function createMazeView(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  // Board origin is the maze center, so tilting pivots around the middle.
  const board = new THREE.Group();
  scene.add(board);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const floor = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.8 }));
  floor.receiveShadow = true;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.7 });
  const walls = new THREE.Group();
  const goal = new THREE.Mesh(
    new THREE.CylinderGeometry(CELL_SIZE * 0.35, CELL_SIZE * 0.35, 1, 32),
    new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.5 }),
  );
  goal.receiveShadow = true;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xe76f51, roughness: 0.3, metalness: 0.1 }),
  );
  ball.castShadow = true;
  board.add(floor, walls, goal, ball);
  const playerVectors = createPlayerVectors(canvas, board, ball, camera);

  let maze: Maze | undefined;
  // Converts maze world coordinates to board-local coordinates.
  const toBoard = (x: number, y: number) =>
    maze ? { x: x - (maze.cols * CELL_SIZE) / 2, z: y - (maze.rows * CELL_SIZE) / 2 } : { x: 0, z: 0 };

  function fitCamera() {
    if (!maze) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.clearViewOffset();
    // Board corners under every extreme tilt (including both axes at once, e.g. a (1, 1) team vector),
    // so the framing never clips however the team tilts.
    const halfWidth = (maze.cols * CELL_SIZE + WALL_THICKNESS) / 2;
    const halfDepth = (maze.rows * CELL_SIZE + WALL_THICKNESS) / 2;
    const extremes = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) =>
      new THREE.Euler(-y * MAX_TILT, 0, -x * MAX_TILT))); // same mapping as setTilt
    const corners = extremes.flatMap((rotation) => [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) =>
      [-WALL_THICKNESS, WALL_HEIGHT].map((y) => new THREE.Vector3(sx * halfWidth, y, sz * halfDepth).applyEuler(rotation)))));
    // Perspective makes the near edge widest, so binary-search the closest distance that still fits.
    const extentAt = (distance: number) => {
      camera.position.set(0, distance * Math.cos(CAMERA_ANGLE), distance * Math.sin(CAMERA_ANGLE));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const projected = corners.map((corner) => corner.clone().project(camera));
      const ys = projected.map((point) => point.y);
      const top = Math.max(...ys);
      const bottom = Math.min(...ys);
      return { x: Math.max(...projected.map((point) => Math.abs(point.x))), halfY: (top - bottom) / 2, centerY: (top + bottom) / 2 };
    };
    let near = 1;
    let far = 20000;
    for (let i = 0; i < 40; i++) {
      const middle = (near + far) / 2;
      const extent = extentAt(middle);
      if (Math.max(extent.x, extent.halfY) > 0.94) near = middle;
      else far = middle;
    }
    // Shift the view vertically so the board sits in the middle of the canvas.
    const { centerY } = extentAt(far);
    camera.setViewOffset(width, height, 0, (-centerY * height) / 2, width, height);
  }
  new ResizeObserver(fitCamera).observe(canvas);

  return {
    setPlayerVectors: playerVectors.update,
    setMaze(next: Maze) {
      maze = next;
      const width = maze.cols * CELL_SIZE;
      const depth = maze.rows * CELL_SIZE;
      floor.scale.set(width + WALL_THICKNESS, WALL_THICKNESS, depth + WALL_THICKNESS);
      floor.position.set(0, -WALL_THICKNESS / 2, 0);

      walls.clear();
      for (const rect of wallRects(maze, CELL_SIZE, WALL_THICKNESS)) {
        const wall = new THREE.Mesh(box, wallMaterial);
        const { x, z } = toBoard(rect.x, rect.y);
        wall.position.set(x, WALL_HEIGHT / 2, z);
        wall.scale.set(rect.width, WALL_HEIGHT, rect.height);
        wall.castShadow = true;
        wall.receiveShadow = true;
        walls.add(wall);
      }

      const goalCenter = cellCenter(maze.goal, CELL_SIZE);
      const goalPosition = toBoard(goalCenter.x, goalCenter.y);
      goal.position.set(goalPosition.x, 0.5, goalPosition.z);
      const start = cellCenter(maze.start, CELL_SIZE);
      this.setBall(start.x, start.y);

      const extent = Math.max(width, depth);
      sun.position.set(-extent * 0.4, extent, extent * 0.3);
      Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, far: extent * 3 });
      sun.shadow.camera.updateProjectionMatrix();
      fitCamera();
    },
    /** Ball position in maze world coordinates. */
    setBall(x: number, y: number) {
      const { x: boardX, z } = toBoard(x, y);
      ball.position.set(boardX, BALL_RADIUS, z);
    },
    /** Board tilt, components in [-1, 1]. Positive x lowers the east edge; positive y lowers the north (-z) edge. */
    setTilt(tilt: Vector) {
      board.rotation.z = -tilt.x * MAX_TILT;
      board.rotation.x = -tilt.y * MAX_TILT;
    },
    render() {
      playerVectors.followBall();
      renderer.render(scene, camera);
    },
  };
}
