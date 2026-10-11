import type { ServerMessage, Vector } from "../../shared/protocol";
import { mountMotionControls } from "./controls";
import { mountReadyButton } from "./ready";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const form = document.querySelector<HTMLFormElement>("#join")!;
const room = document.querySelector<HTMLInputElement>("#room")!;
const name = document.querySelector<HTMLInputElement>("#name")!;
const submit = document.querySelector<HTMLButtonElement>("#submit")!;
const controls = document.querySelector<HTMLFieldSetElement>("#controls")!;
const vector = document.querySelector<HTMLOutputElement>("#vector")!;
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
let playerId: string | null = null;
let roomClosed = false;
let seq = 0;
const ready = mountReadyButton(socket, () => playerId);
const motion = mountMotionControls(sendVector, () => !!playerId && !roomClosed && socket.readyState === WebSocket.OPEN,
  () => { ready.setAllowed(true); ready.setReady(true); },
  () => ready.recalibrate());
function sendVector(value: Vector, showCoordinates = true) {
  if (showCoordinates) vector.textContent = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
  if (playerId && !roomClosed && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "vec", seq: seq++, ...value }));
  }
}
socket.onopen = () => { status.textContent = "Enter your room code."; submit.disabled = false; };
form.onsubmit = (event) => {
  event.preventDefault();
  if (socket.readyState !== WebSocket.OPEN || playerId) return;
  submit.disabled = true;
  socket.send(JSON.stringify({ type: "join", room: room.value.trim(), name: name.value.trim() }));
};
socket.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);
  if (message.type === "joined") {
    playerId = message.playerId;
    form.hidden = true;
    controls.hidden = false;
    controls.disabled = false;
    status.textContent = `Room ${message.room}`;
  } else if (message.type === "players") {
    ready.update(message.players);
  } else if (message.type === "error") {
    ready.reject();
    status.textContent = message.message === "Unsupported message type."
      ? "Restart the room server, then refresh all screens." : message.message;
    submit.disabled = !!playerId;
  } else if (message.type === "room_closed") {
    roomClosed = true;
    motion.stop();
    controls.disabled = true;
    status.textContent = "Room closed. Refresh to join again.";
  }
};
socket.onclose = () => {
  motion.stop();
  ready.reject();
  controls.disabled = true;
  submit.disabled = true;
  if (!roomClosed) status.textContent = "Disconnected. Refresh to join again.";
};
socket.onerror = () => { status.textContent = "Can't connect to the room server."; };
