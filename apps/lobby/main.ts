import type { Player, ServerMessage, Vector } from "../../shared/protocol";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const setup = document.querySelector<HTMLDivElement>("#setup")!;
const create = document.querySelector<HTMLButtonElement>("#create")!;
const join = document.querySelector<HTMLFormElement>("#join")!;
const submit = document.querySelector<HTMLButtonElement>("#submit")!;
const name = document.querySelector<HTMLInputElement>("#name")!;
const code = document.querySelector<HTMLInputElement>("#code")!;
const roomInfo = document.querySelector<HTMLDivElement>("#room-info")!;
const roomCode = document.querySelector<HTMLSpanElement>("#room-code")!;
const roomNote = document.querySelector<HTMLParagraphElement>("#room-note")!;
const back = document.querySelector<HTMLButtonElement>("#back")!;
const list = document.querySelector<HTMLUListElement>("#players")!;
const count = document.querySelector<HTMLSpanElement>("#count")!;
const empty = document.querySelector<HTMLParagraphElement>("#empty")!;
const controls = document.querySelector<HTMLFieldSetElement>("#controls")!;
const x = document.querySelector<HTMLInputElement>("#x")!;
const y = document.querySelector<HTMLInputElement>("#y")!;
const vector = document.querySelector<HTMLOutputElement>("#vector")!;
const team = document.querySelector<HTMLParagraphElement>("#team")!;
const mean = document.querySelector<HTMLOutputElement>("#mean")!;
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
let role: "host" | "player" | null = null;
let playerId: string | null = null;
let closedRoom = false;
let seq = 0;
const vectors = new Map<string, Vector>();

function buttons(disabled: boolean) { create.disabled = disabled; submit.disabled = disabled; }
function showRoom(code: string) {
  setup.hidden = true;
  roomInfo.hidden = false;
  roomCode.textContent = code;
}
function renderMean() {
  let x = 0, y = 0;
  for (const value of vectors.values()) { x += value.x; y += value.y; }
  mean.textContent = vectors.size ? `(${(x / vectors.size).toFixed(2)}, ${(y / vectors.size).toFixed(2)})` : "(0.00, 0.00)";
}
function renderPlayers(players: Player[]) {
  list.replaceChildren();
  const present = new Set(players.map((player) => player.id));
  for (const id of vectors.keys()) if (!present.has(id)) vectors.delete(id);
  for (const player of players) {
    if (!vectors.has(player.id)) vectors.set(player.id, { x: 0, y: 0 });
    const item = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.backgroundColor = player.color;
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = player.name + (player.id === playerId ? " (you)" : "");
    item.append(dot, label);
    list.append(item);
  }
  count.textContent = String(players.length);
  empty.hidden = players.length > 0;
  renderMean();
}
socket.onopen = () => { status.textContent = "Create a room or enter a code to join."; buttons(false); };
back.onclick = () => {
  back.disabled = true;
  if (socket.readyState === WebSocket.CLOSED) {
    location.reload();
    return;
  }
  // Finish closing the hosted room before opening a fresh menu connection.
  socket.addEventListener("close", () => location.reload(), { once: true });
  socket.close(1000, "Host returned to menu");
};
create.onclick = () => {
  if (socket.readyState !== WebSocket.OPEN || role) return;
  buttons(true);
  socket.send(JSON.stringify({ type: "create" }));
};
join.onsubmit = (event) => {
  event.preventDefault();
  if (socket.readyState !== WebSocket.OPEN || role) return;
  buttons(true);
  socket.send(JSON.stringify({ type: "join", room: code.value.trim(), name: name.value.trim() }));
};
socket.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);
  if (message.type === "created") {
    role = "host";
    back.hidden = false;
    showRoom(message.room);
    roomNote.textContent = "Share this code with your players. Keep this page open.";
    status.textContent = "Room open. Waiting for players.";
    team.hidden = false;
  } else if (message.type === "joined") {
    role = "player";
    playerId = message.playerId;
    showRoom(message.room);
    roomNote.textContent = `Joined as ${name.value.trim()}.`;
    status.textContent = "You're in!";
    controls.hidden = false;
    controls.disabled = false;
  } else if (message.type === "players") {
    renderPlayers(message.players);
  } else if (message.type === "vec") {
    if (vectors.has(message.playerId)) vectors.set(message.playerId, { x: message.x, y: message.y });
    renderMean();
  } else if (message.type === "error") {
    status.textContent = message.message;
    buttons(role !== null);
  } else if (message.type === "room_closed") {
    closedRoom = true;
    renderPlayers([]);
    controls.disabled = true;
    status.textContent = "Host closed the room. Reload to join another room.";
  }
};
function sendVector() {
  if (role !== "player" || closedRoom || socket.readyState !== WebSocket.OPEN) return;
  const value = { x: Number(x.value), y: Number(y.value) };
  vector.textContent = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
  socket.send(JSON.stringify({ type: "vec", seq: seq++, ...value }));
}
x.oninput = y.oninput = sendVector;
socket.onclose = () => {
  buttons(true);
  controls.disabled = true;
  if (!closedRoom) status.textContent = "Connection closed. Reload to connect again.";
};
socket.onerror = () => { status.textContent = "Connection error. Check that the room server is running."; };
