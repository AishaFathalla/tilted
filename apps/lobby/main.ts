import type { Player, ServerMessage, Vector } from "../../shared/protocol";
import { mountMotionControls } from "../controller/controls";
import { mountReadyButton } from "../controller/ready";
import { updatePhoneIdentity } from "../controller/phone-view";
import "../controller/phone-view.css";
import { createGameAudio } from "../host/audio";
import type { Maze } from "../host/maze";

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
const vector = document.querySelector<HTMLOutputElement>("#vector")!;
const team = document.querySelector<HTMLParagraphElement>("#team")!;
const mean = document.querySelector<HTMLOutputElement>("#mean")!;
const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
let role: "host" | "player" | null = null;
let playerId: string | null = null;
let closedRoom = false;
let seq = 0;
const vectors = new Map<string, Vector>();
let roster: Player[] = [];
const gamePanel = document.querySelector<HTMLElement>("#game-panel")!;
const mazeStatus = document.querySelector<HTMLParagraphElement>("#maze-status")!;
const mazeSeed = document.querySelector<HTMLSpanElement>("#maze-seed")!;
const mazeStage = document.querySelector<HTMLDivElement>("#maze-stage")!;
const mazeLock = document.querySelector<HTMLDivElement>("#maze-lock")!;
const newMaze = document.querySelector<HTMLButtonElement>("#new-maze")!;
const restartMaze = document.querySelector<HTMLButtonElement>("#restart-maze")!;
const timer = document.querySelector<HTMLOutputElement>("#timer")!;
const audio = createGameAudio();
const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle")!;
let soundEnabled = true;
soundToggle.onclick = () => {
  soundEnabled = !soundEnabled;
  audio.setEnabled(soundEnabled);
  soundToggle.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
};
const resultDialog = document.querySelector<HTMLDialogElement>("#round-result")!;
const resultTitle = document.querySelector<HTMLHeadingElement>("#result-title")!;
const resultMessage = document.querySelector<HTMLParagraphElement>("#result-message")!;
const restartRound = document.querySelector<HTMLButtonElement>("#restart-round")!;
const nextRound = document.querySelector<HTMLButtonElement>("#next-round")!;
const exitRound = document.querySelector<HTMLButtonElement>("#exit-round")!;
const ROUND_SECONDS = 180;
let currentMaze: Maze | undefined;
let resettingReady = false;
let roundStarted = false;
let restartCurrentMaze: (() => void) | undefined;
const readyButton = mountReadyButton(socket, () => playerId);
resultDialog.oncancel = (event) => event.preventDefault();
function showResult(won: boolean, seconds?: number) {
  audio.finish(won);
  resultDialog.classList.toggle("won", won);
  resultDialog.querySelector(".result-emblem")!.textContent = won ? "✦" : "◷";
  resultTitle.textContent = won ? "Teamwork makes tilt work" : "So close. One more tilt?";
  resultMessage.textContent = won ? `Maze cleared in ${seconds!.toFixed(1)} seconds.` : "Time's up! Find your rhythm and give this maze another go.";
  mazeStatus.textContent = won ? "Maze complete." : "Round over.";
  if (!resultDialog.open) resultDialog.showModal();
}
let game: ReturnType<typeof import("../host/game").createGame> | undefined;
let latestMean: Vector = { x: 0, y: 0 };
const motion = mountMotionControls(sendVector, () => role === "player" && !closedRoom && socket.readyState === WebSocket.OPEN,
  () => { readyButton.setAllowed(true); readyButton.setReady(true); },
  () => readyButton.recalibrate());

async function startGame() {
  gamePanel.hidden = false;
  document.querySelector("main")!.classList.add("hosting");
  newMaze.disabled = true;
  try {
    const [{ createGame }, { generateChallengeMaze }] = await Promise.all([import("../host/game"), import("../host/maze")]);
    if (socket.readyState !== WebSocket.OPEN) return;
    game = createGame(document.querySelector<HTMLCanvasElement>("#maze")!, (seconds) => {
      showResult(true, seconds);
    }, {
      durationSeconds: ROUND_SECONDS,
      requireReady: true,
      onLost: () => showResult(false),
      onImpact: (speed) => audio.impact(speed),
      onTick: (remaining, started) => {
        audio.tick(remaining, started);
        if (started && !roundStarted) {
          roundStarted = true;
          mazeStage.classList.remove("waiting");
          mazeLock.hidden = true;
          mazeStatus.textContent = "Reach the green goal in 3 minutes!";
        }
        const seconds = Math.ceil(remaining);
        timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        timer.classList.toggle("urgent", started && seconds <= 10);
      },
    });
    const showMaze = (restart = false, initial = false) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (resultDialog.open) resultDialog.close();
      if (!restart || !currentMaze) currentMaze = generateChallengeMaze(Math.floor(Math.random() * 2 ** 32));
      mazeSeed.textContent = String(currentMaze.seed);
      roundStarted = false;
      audio.reset();
      mazeStage.classList.add("waiting");
      mazeLock.hidden = false;
      resettingReady = !initial;
      if (!initial) socket.send(JSON.stringify({ type: "reset_ready" }));
      mazeStatus.textContent = "Waiting for players.";
      game!.setMaze(currentMaze);
      renderPlayers(roster);
    };
    newMaze.onclick = () => showMaze();
    restartMaze.onclick = () => showMaze(true);
    restartCurrentMaze = () => showMaze(true, true);
    restartRound.onclick = () => showMaze(true);
    nextRound.onclick = () => showMaze();
    exitRound.onclick = () => back.click();
    showMaze(false, true);
    game.setTeamVector(latestMean);
    updatePlayerVectors();
    newMaze.disabled = false;
    restartMaze.disabled = false;
  } catch {
    mazeStatus.textContent = "Could not display the maze. Enable WebGL and reload. Players can still test their controls.";
  }
}

function buttons(disabled: boolean) { create.disabled = disabled; submit.disabled = disabled; }
function showRoom(code: string) {
  setup.hidden = true;
  roomInfo.hidden = false;
  roomCode.textContent = code;
}
function renderMean() {
  let x = 0, y = 0;
  for (const value of vectors.values()) { x += value.x; y += value.y; }
  latestMean = { x: vectors.size ? x / vectors.size : 0, y: vectors.size ? y / vectors.size : 0 };
  mean.textContent = `(${latestMean.x.toFixed(2)}, ${latestMean.y.toFixed(2)})`;
  game?.setTeamVector(latestMean);
  updatePlayerVectors();
}
function updatePlayerVectors() {
  game?.setPlayerVectors(roster.map((player) => ({ ...player, vector: vectors.get(player.id) ?? { x: 0, y: 0 } })));
}
function renderPlayers(players: Player[]) {
  roster = players;
  updatePhoneIdentity(players.find((player) => player.id === playerId));
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
    const readiness = document.createElement("span");
    readiness.className = `player-ready${player.ready ? " is-ready" : ""}`;
    readiness.textContent = player.ready ? "Ready" : "Not ready";
    item.append(dot, label, readiness);
    list.append(item);
  }
  count.textContent = String(players.length);
  empty.hidden = players.length > 0;
  readyButton.update(players);
  game?.setReady(!resettingReady && players.length > 0 && players.every((player) => player.ready));
  if (game && !roundStarted && !resettingReady) {
    mazeStatus.textContent = players.length
      ? `${players.filter((player) => player.ready).length}/${players.length} ready`
      : "Waiting for players.";
  }
  renderMean();
}
socket.onopen = () => { status.textContent = "Create a room or enter a code to join."; buttons(false); };
back.onclick = () => {
  audio.reset();
  game?.stop();
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
  audio.unlock();
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
    roomNote.textContent = "Share this code with friends.";
    status.textContent = "Room open";
    void startGame();
  } else if (message.type === "joined") {
    role = "player";
    document.body.classList.add("playing-phone");
    playerId = message.playerId;
    showRoom(message.room);
    roomNote.textContent = `Joined as ${name.value.trim()}.`;
    status.textContent = "You're in!";
    controls.hidden = false;
    controls.disabled = false;
  } else if (message.type === "round_restart") {
    for (const id of vectors.keys()) vectors.set(id, { x: 0, y: 0 });
    roster = roster.map((player) => ({ ...player, ready: false }));
    restartCurrentMaze?.();
  } else if (message.type === "ready_reset") {
    resettingReady = false;
  } else if (message.type === "players") {
    renderPlayers(message.players);
  } else if (message.type === "vec") {
    if (vectors.has(message.playerId)) vectors.set(message.playerId, { x: message.x, y: message.y });
    renderMean();
  } else if (message.type === "error") {
    readyButton.reject();
    if (message.message === "Unsupported message type.") {
      status.textContent = "Restart the room server, then refresh all screens.";
      return;
    }
    status.textContent = message.message;
    buttons(role !== null);
  } else if (message.type === "room_closed") {
    closedRoom = true;
    motion.stop();
    renderPlayers([]);
    controls.disabled = true;
    status.textContent = "Host closed the room. Reload to join another room.";
  }
};
function sendVector(value: Vector, showCoordinates = true) {
  if (role !== "player" || closedRoom || socket.readyState !== WebSocket.OPEN) return;
  if (showCoordinates) vector.textContent = `(${value.x.toFixed(2)}, ${value.y.toFixed(2)})`;
  socket.send(JSON.stringify({ type: "vec", seq: seq++, ...value }));
}
socket.onclose = () => {
  audio.reset();
  game?.stop();
  restartRound.disabled = nextRound.disabled = true;
  motion.stop();
  game?.setTeamVector({ x: 0, y: 0 });
  game?.setPlayerVectors([]);
  newMaze.disabled = true;
  restartMaze.disabled = true;
  buttons(true);
  controls.disabled = true;
  if (!closedRoom) status.textContent = "Connection closed. Reload to connect again.";
};
socket.onerror = () => { status.textContent = "Connection error. Check that the room server is running."; };
