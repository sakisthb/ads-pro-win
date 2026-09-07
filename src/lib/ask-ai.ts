/** Dispatch a prompt into the in-app Ask AI widget (`FloatingChat`). */

export const ASK_AI_EVENT = "adspro:ask";

export function askAi(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASK_AI_EVENT, { detail: { prompt: trimmed } }));
}
