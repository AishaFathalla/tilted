import * as THREE from "three";
import type { Vector } from "../../shared/protocol";
import { BALL_RADIUS, CELL_SIZE } from "./dimensions";
import "./player-vectors.css";

export type PlayerInput = { id: string; name: string; color: string; vector: Vector };

// Flat, quiet indicators outside the ball's silhouette; no 3D arrow meshes.
export function createPlayerVectors(canvas: HTMLCanvasElement, board: THREE.Group, ball: THREE.Object3D, camera: THREE.Camera) {
  const namespace = "http://www.w3.org/2000/svg";
  const wrapper = document.createElement("div");
  wrapper.className = "maze-with-inputs";
  canvas.before(wrapper);
  wrapper.append(canvas);
  const overlay = document.createElementNS(namespace, "svg");
  overlay.classList.add("ball-input-overlay");
  overlay.setAttribute("aria-hidden", "true");
  const group = document.createElementNS(namespace, "g");
  overlay.append(group);
  wrapper.append(overlay);
  const entries = new Map<string, { path: SVGPathElement; player: PlayerInput }>();
  const center = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const endpoint = new THREE.Vector3();
  const cameraRight = new THREE.Vector3();

  return {
    update(players: PlayerInput[]) {
      const present = new Set(players.map((player) => player.id));
      for (const [id, entry] of entries) {
        if (!present.has(id)) { entry.path.remove(); entries.delete(id); }
      }
      for (const player of players) {
        let entry = entries.get(player.id);
        if (!entry) {
          const path = document.createElementNS(namespace, "path");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke-width", "1.5");
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          group.append(path);
          entry = { path, player };
          entries.set(player.id, entry);
        }
        entry.player = player;
        entry.path.setAttribute("stroke", player.color);
      }
      overlay.toggleAttribute("hidden", players.length === 0);
    },
    followBall() {
      if (!entries.size) return;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      board.updateWorldMatrix(true, true);
      camera.updateWorldMatrix(true, false);
      ball.getWorldPosition(center);
      // Estimate the visible ball radius in pixels using the camera's right axis.
      cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(BALL_RADIUS);
      edge.copy(center).add(cameraRight).project(camera);
      center.project(camera);
      const radius = Math.max(4, Math.abs(edge.x - center.x) * width / 2);
      group.setAttribute("transform", `translate(${(center.x + 1) * width / 2} ${(1 - center.y) * height / 2})`);
      let index = 0;
      for (const { path, player } of entries.values()) {
        const magnitude = Math.hypot(player.vector.x, player.vector.y);
        if (magnitude < .03) { path.setAttribute("d", ""); index++; continue; }
        // Project a board-space input so the 2D arrow agrees with the visible maze.
        endpoint.copy(ball.position).add(new THREE.Vector3(player.vector.x * CELL_SIZE, 0, -player.vector.y * CELL_SIZE));
        board.localToWorld(endpoint).project(camera);
        const angle = Math.atan2(-(endpoint.y - center.y) * height, (endpoint.x - center.x) * width);
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const lane = Math.max(-6, Math.min(6, (index - (entries.size - 1) / 2) * 3));
        const startX = dx * (radius + 8) - dy * lane;
        const startY = dy * (radius + 8) + dx * lane;
        const length = 5 + Math.min(magnitude, 1) * 8;
        const x = startX + dx * length, y = startY + dy * length;
        path.setAttribute("d", `M${startX} ${startY}L${x} ${y}M${x - 3.5 * Math.cos(angle - .55)} ${y - 3.5 * Math.sin(angle - .55)}L${x} ${y}L${x - 3.5 * Math.cos(angle + .55)} ${y - 3.5 * Math.sin(angle + .55)}`);
        index++;
      }
    },
  };
}
