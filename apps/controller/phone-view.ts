import type { Player, Vector } from "../../shared/protocol";

export function mountPhoneView(controls: HTMLElement) {
  const card = document.createElement("div");
  card.className = "pilot-card";
  card.innerHTML = `<div class="pilot-heading"><span class="pilot-label">YOUR CONTRIBUTION</span><strong id="pilot-name">Your tilt</strong></div>
    <svg class="tilt-pad" viewBox="-120 -120 240 240" role="img" aria-label="Your tilt direction and strength">
      <circle class="pad-field" r="104"/><circle class="pad-ring" r="76"/><circle class="pad-ring" r="42"/>
      <path class="pad-axis" d="M-94 0H94M0-94V94"/>
      <text x="0" y="-88" text-anchor="middle">↑</text><text x="91" y="4" text-anchor="middle">→</text>
      <text x="0" y="96" text-anchor="middle">↓</text><text x="-91" y="4" text-anchor="middle">←</text>
      <circle class="pad-glow" r="17"/><path class="pad-arrow"/><circle class="pad-center" r="6"/>
    </svg><div class="pilot-readout"><span class="pilot-state">Find your neutral</span><span class="pilot-strength">0%</span></div>
    <div class="pilot-meter"><span></span></div><p class="pilot-tip">Tilt together. Watch the shared screen.</p>`;
  controls.prepend(card);
  const arrow = card.querySelector<SVGPathElement>(".pad-arrow")!;
  const meter = card.querySelector<HTMLElement>(".pilot-meter span")!;
  const strength = card.querySelector<HTMLElement>(".pilot-strength")!;
  const state = card.querySelector<HTMLElement>(".pilot-state")!;
  return {
    update(vector: Vector) {
      const magnitude = Math.min(1, Math.hypot(vector.x, vector.y));
      const x = vector.x * 78, y = -vector.y * 78;
      const angle = Math.atan2(y, x);
      arrow.setAttribute("d", magnitude < .03 ? "" : `M0 0L${x} ${y}M${x - 12 * Math.cos(angle - .55)} ${y - 12 * Math.sin(angle - .55)}L${x} ${y}L${x - 12 * Math.cos(angle + .55)} ${y - 12 * Math.sin(angle + .55)}`);
      meter.style.width = `${Math.round(magnitude * 100)}%`;
      strength.textContent = `${Math.round(magnitude * 100)}%`;
      card.classList.toggle("tilting", magnitude >= .03);
    },
    calibrated(value: boolean) {
      card.classList.toggle("is-calibrated", value);
      state.textContent = value ? "You're ready!" : "Find your neutral";
    },
  };
}

export function updatePhoneIdentity(player: Player | undefined) {
  const card = document.querySelector<HTMLElement>(".pilot-card");
  if (!card || !player) return;
  card.style.setProperty("--pilot-color", player.color);
  card.querySelector("#pilot-name")!.textContent = player.name;
}
