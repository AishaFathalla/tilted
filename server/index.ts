import { randomInt, randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import type { Player, ServerMessage } from "../shared/protocol";

const server = new WebSocketServer({ port: 8080, path: "/ws", maxPayload: 4096 });
type Room = { code: string; host: WebSocket; players: Map<WebSocket, Player> };
let room: Room | undefined;

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

server.on("connection", (socket) => {
  let role: "unassigned" | "host" | "controller" = "unassigned";
  socket.on("error", (error) => console.error("Socket error:", error.message));
  socket.on("message", (data, isBinary) => {
    const reject = (message: string) => send(socket, { type: "error", message });
    let message: unknown;
    try {
      if (isBinary) return reject("Send JSON text messages.");
      message = JSON.parse(data.toString());
    } catch {
      return reject("Malformed JSON.");
    }
    if (typeof message !== "object" || message === null || !("type" in message)) {
      return reject("Invalid message.");
    }
    if (message.type === "vec") {
      const player = room?.players.get(socket);
      if (role !== "controller" || !room || !player) {
        return reject("Only a joined controller can send vectors.");
      }
      if (!("seq" in message) || typeof message.seq !== "number" ||
          !Number.isSafeInteger(message.seq) || message.seq < 0 ||
          !("x" in message) || typeof message.x !== "number" ||
          !Number.isFinite(message.x) || Math.abs(message.x) > 1 ||
          !("y" in message) || typeof message.y !== "number" ||
          !Number.isFinite(message.y) || Math.abs(message.y) > 1) {
        return reject("Vectors require a nonnegative integer seq and x/y components in [-1, 1].");
      }
      send(room.host, { type: "vec", playerId: player.id, seq: message.seq, x: message.x, y: message.y });
      return;
    }
    if (message.type !== "create" && message.type !== "join") {
      return reject("Unsupported message type.");
    }
    if (role !== "unassigned") return reject("Socket already assigned a role.");

    if (message.type === "create") {
      if (room) return reject("A room is already open.");
      room = { code: String(randomInt(100000, 1000000)), host: socket, players: new Map() };
      role = "host";
      send(socket, { type: "created", room: room.code });
      return;
    }
    if (!("room" in message) || typeof message.room !== "string" ||
        !("name" in message) || typeof message.name !== "string" ||
        !message.name.trim() || message.name.trim().length > 40) {
      return reject("Enter a room code and a name of 1–40 characters.");
    }
    if (!room || message.room.trim() !== room.code) return reject("Room not found.");
    const player = { id: randomUUID(), name: message.name.trim() };
    role = "controller";
    room.players.set(socket, player);
    send(socket, { type: "joined", room: room.code, playerId: player.id });
    send(room.host, { type: "player_joined", player });
  });

  socket.on("close", () => {
    if (!room) return;
    if (room.host === socket) {
      const closedRoom = room;
      room = undefined;
      for (const controller of closedRoom.players.keys()) {
        send(controller, { type: "room_closed" });
        controller.close(1000, "Host closed the room");
      }
    } else {
      const player = room.players.get(socket);
      if (player) {
        room.players.delete(socket);
        send(room.host, { type: "player_left", playerId: player.id });
      }
    }
  });
});
server.on("error", (error) => { console.error("Server error:", error.message); process.exit(1); });
console.log("Room server listening on port 8080 (/ws)");
