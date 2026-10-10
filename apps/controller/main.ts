import type { ServerMessage } from "../../shared/protocol";

const status = document.querySelector<HTMLParagraphElement>("#status")!;
const form = document.querySelector<HTMLFormElement>("#join")!;
const room = document.querySelector<HTMLInputElement>("#room")!;
const name = document.querySelector<HTMLInputElement>("#name")!;
const submit = document.querySelector<HTMLButtonElement>("#submit")!;
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
const controls = document.querySelector<HTMLFieldSetElement>("#controls")!;
const x = document.querySelector<HTMLInputElement>("#x")!;
const y = document.querySelector<HTMLInputElement>("#y")!;
const vector = document.querySelector<HTMLOutputElement>("#vector")!;
let seq = 0;
function sendVector() {
  if (!joined || socket.readyState !== WebSocket.OPEN) return;
  const value = { x: Number(x.value), y: Number(y.value) };
  vector.textContent = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
  socket.send(JSON.stringify({ type: "vec", seq: seq++, ...value }));
}
x.oninput = sendVector;
y.oninput = sendVector;
let joined = false;
let roomClosed = false;
socket.onopen = () => { status.textContent = "Connected. Enter the host’s room code."; submit.disabled = false; };
form.onsubmit = (event) => {
  event.preventDefault();
  submit.disabled = true;
  socket.send(JSON.stringify({ type: "join", room: room.value.trim(), name: name.value.trim() }));
};
socket.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);
  if (message.type === "joined") {
    joined = true;
    form.hidden = true;
    controls.hidden = false;
    controls.disabled = false;
    status.textContent = `Joined room ${message.room} as ${name.value.trim()}.`;
  } else if (message.type === "error") {
    status.textContent = message.message;
    submit.disabled = joined;
  } else if (message.type === "room_closed") {
    roomClosed = true;
    controls.disabled = true;
    status.textContent = "Host closed the room. Reload to join a new room.";
    submit.disabled = true;
  }
};
socket.onclose = () => {
  controls.disabled = true;
  if (!roomClosed) status.textContent = "Connection closed. Reload to join again.";
  submit.disabled = true;
};
socket.onerror = () => { status.textContent = "Connection error. Check that the room server is running."; };
