import type { Player } from "../../shared/protocol";

/** Readiness is confirmed by the server, so every screen shows the same state. */
export function mountReadyButton(socket: WebSocket, getPlayerId: () => string | null) {
  const button = document.querySelector<HTMLButtonElement>("#ready")!;
  let ready = false;
  let allowed = true;
  let pending: ReturnType<typeof setTimeout> | undefined;
  function setReady(value: boolean) {
    if (!getPlayerId() || socket.readyState !== WebSocket.OPEN) return;
    button.disabled = true;
    button.textContent = value ? "Joining round…" : "Updating…";
    clearTimeout(pending);
    pending = setTimeout(() => {
      reject();
      button.textContent = ready ? "Ready!" : "Ready — retry";
    }, 4000);
    socket.send(JSON.stringify({ type: "ready", ready: value }));
  }
  function reject() {
    clearTimeout(pending);
    button.textContent = ready ? "Ready!" : "Ready";
    button.setAttribute("aria-pressed", String(ready));
    button.disabled = !allowed || !getPlayerId() || socket.readyState !== WebSocket.OPEN;
  }
  button.onclick = () => { if (allowed) setReady(!ready); };
  return {
    reject,
    setReady,
    recalibrate() {
      if (!getPlayerId() || socket.readyState !== WebSocket.OPEN) return;
      allowed = false;
      reject();
      socket.send(JSON.stringify({ type: "recalibrate" }));
    },
    setAllowed(value: boolean) { allowed = value; button.disabled = !allowed || !getPlayerId() || socket.readyState !== WebSocket.OPEN; },
    update(players: Player[]) {
      clearTimeout(pending);
      ready = players.find((player) => player.id === getPlayerId())?.ready ?? false;
      button.textContent = ready ? "Ready!" : "Ready";
      button.setAttribute("aria-pressed", String(ready));
      button.disabled = !allowed || !getPlayerId() || socket.readyState !== WebSocket.OPEN;
    },
  };
}
