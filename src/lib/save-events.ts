// Implemented by Codex. Notification only; local writes never depend on a network request.
export const SAVE_CHANGED = "ps:progress-changed";
export function progressChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(SAVE_CHANGED));
}
