export function calibrationFeedback(button: HTMLButtonElement, status: HTMLElement) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const reset = () => {
    clearTimeout(timeout);
    button.textContent = "Calibrate";
  };
  return {
    reset,
    show() {
      reset();
      button.textContent = "✓ Calibrated!";
      const confirmation = document.createElement("span");
      confirmation.textContent = "Calibrated!";
      status.replaceChildren(confirmation);
      // Replay the visual acknowledgment even when the same message is already showing.
      status.animate([{ backgroundColor: "#dcefd5" }, { backgroundColor: "transparent" }], { duration: 900 });
    },
  };
}
