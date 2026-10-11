export type Vector = { x: number; y: number };

export type Player = { id: string; name: string; color: string; ready: boolean };

export type ClientMessage =
  | { type: "create" }
  | { type: "join"; room: string; name: string }
  | { type: "ready"; ready: boolean }
  | { type: "reset_ready" }
  | { type: "recalibrate" }
  | ({ type: "vec"; seq: number } & Vector);

export type ServerMessage =
  | { type: "players"; players: Player[] }
  | { type: "ready_reset" }
  | { type: "round_restart" }
  | { type: "created"; room: string }
  | { type: "joined"; room: string; playerId: string }
  | { type: "player_joined"; player: Player }
  | ({ type: "vec"; playerId: string; seq: number } & Vector)
  | { type: "player_left"; playerId: string }
  | { type: "room_closed" }
  | { type: "error"; message: string };
