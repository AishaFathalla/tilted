import type { ServerMessage, Vector } from "../../shared/protocol";
import { createGame } from "./game";
import { generateChallengeMaze } from "./maze";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const create = document.querySelector<HTMLButtonElement>("#create")!;
const room = document.querySelector<HTMLParagraphElement>("#room")!;
const list = document.querySelector<HTMLUListElement>("#players")!;
const count = document.querySelector<HTMLSpanElement>("#count")!;
const mean = document.querySelector<HTMLParagraphElement>("#mean")!;
const meanArrow = document.querySelector<SVGSVGElement>("#mean-arrow")!;
const emptyList = document.querySelector<HTMLParagraphElement>("#no-players")!;
const playerColors = ["#d95764", "#4885ce", "#529d65", "#b08a24", "#8b63be", "#d67439", "#369b9b", "#bd608f"];
const players = new Map<string, { item: HTMLLIElement; name: string; vector: Vector; color: string }>();
let extraColor = 0;
function nextPlayerColor(): string {
  const used = new Set([...players.values()].map((player) => player.color));
  return playerColors.find((color) => !used.has(color)) ?? `hsl(${(extraColor++ * 137.5) % 360} 55% 45%)`;
}
function drawArrow(svg: SVGSVGElement, vector: Vector) {
  // SVG Y increases downward; control Y increases upward.
  const x = vector.x * 70;
  const y = -vector.y * 70;
  const angle = Math.atan2(y, x);
  const head = Math.hypot(x, y) > 0 ? `<path d="M ${x - 9 * Math.cos(angle - 0.5)} ${y - 9 * Math.sin(angle - 0.5)} L ${x} ${y} L ${x - 9 * Math.cos(angle + 0.5)} ${y - 9 * Math.sin(angle + 0.5)}"/>` : "";
  svg.innerHTML = `<path d="M -100 0 H 100 M 0 -100 V 100" stroke="#ccc"/><g stroke="currentColor" stroke-width="3" fill="none"><path d="M 0 0 L ${x} ${y}"/>${head}</g><circle r="3" fill="currentColor"/>`;
}
function render() {
  let x = 0;
  let y = 0;
  for (const player of players.values()) {
    x += player.vector.x;
    y += player.vector.y;
    player.item.replaceChildren();
    const dot = document.createElement("span");
    dot.className = "player-color";
    dot.style.backgroundColor = player.color;
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "player-info";
    const playerName = document.createElement("strong");
    playerName.textContent = player.name;
    const coordinates = document.createElement("small");
    coordinates.textContent = `(${player.vector.x.toFixed(2)}, ${player.vector.y.toFixed(2)})`;
    label.append(playerName, coordinates);
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("viewBox", "-110 -110 220 220");
    arrow.setAttribute("width", "120");
    arrow.setAttribute("height", "120");
    arrow.setAttribute("aria-label", `${player.name} vector`);
    arrow.setAttribute("role", "img");
    arrow.style.color = player.color;
    drawArrow(arrow, player.vector);
    player.item.append(dot, label, arrow);
  }
  const value = { x: players.size ? x / players.size : 0, y: players.size ? y / players.size : 0 };
  count.textContent = String(players.size);
  emptyList.hidden = players.size > 0;
  mean.textContent = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
  drawArrow(meanArrow, value);
  game.setTeamVector(value);
  game.setPlayerVectors([...players].map(([id, player]) => ({ id, name: player.name, color: player.color, vector: player.vector })));
}
const mazeSeed = document.querySelector<HTMLSpanElement>("#maze-seed")!;
const mazeStatus = document.querySelector<HTMLParagraphElement>("#maze-status")!;
const newMaze = document.querySelector<HTMLButtonElement>("#new-maze")!;
const game = createGame(document.querySelector<HTMLCanvasElement>("#maze")!, (seconds) => {
  mazeStatus.textContent = `Goal reached in ${seconds.toFixed(1)} s!`;
});
function showNewMaze() {
  const maze = generateChallengeMaze(Math.floor(Math.random() * 2 ** 32));
  mazeSeed.textContent = String(maze.seed);
  mazeStatus.textContent = "Tilt together to roll the ball to the green goal.";
  game.setMaze(maze);
}
newMaze.onclick = showNewMaze;
showNewMaze();
render();
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
let created = false;
socket.onopen = () => { status.textContent = "Connected. Create a room."; create.disabled = false; };
create.onclick = () => { create.disabled = true; socket.send(JSON.stringify({ type: "create" })); };
socket.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);
  if (message.type === "created") {
    created = true;
    status.textContent = "Room open. Waiting for players.";
    room.textContent = `Room code: ${message.room}. Phones: ${location.origin}/apps/controller/`;
  } else if (message.type === "player_joined") {
    const item = document.createElement("li");
    players.set(message.player.id, { item, name: message.player.name, vector: { x: 0, y: 0 }, color: message.player.color ?? nextPlayerColor() });
    list.append(item);
    render();
  } else if (message.type === "player_left") {
    players.get(message.playerId)?.item.remove();
    players.delete(message.playerId);
    render();
  } else if (message.type === "vec") {
    const player = players.get(message.playerId);
    if (player) {
      player.vector = { x: message.x, y: message.y };
      render();
    }
  } else if (message.type === "error") {
    status.textContent = message.message;
    create.disabled = created;
  }
};
socket.onclose = () => { status.textContent = "Connection closed. Reload to start again."; create.disabled = true; };
socket.onerror = () => { status.textContent = "Connection error. Check that the room server is running."; };
