/**
 * A DJ deck must never keep playing unnoticed after a mobile app switch,
 * page navigation, or component unmount. It must not auto-resume on focus:
 * the player has to explicitly press Play again.
 *
 * This is deliberately independent of React and the live DJ reward ledger.
 */
export function bindDjDeckLifecycle(
  player: Pick<HTMLMediaElement, "pause">,
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">,
  viewport: Pick<Window, "addEventListener" | "removeEventListener">,
): () => void {
  const pause = () => player.pause();
  const visibilityChanged = () => {
    if (page.visibilityState !== "visible") pause();
  };

  page.addEventListener("visibilitychange", visibilityChanged);
  viewport.addEventListener("pagehide", pause);
  // Chromium may freeze a backgrounded Android tab before any later pagehide.
  // Do not retain audible media in a frozen/restored webview.
  page.addEventListener("freeze", pause);
  // Covers mounting a deck while the document is already backgrounded.
  visibilityChanged();

  return () => {
    page.removeEventListener("visibilitychange", visibilityChanged);
    viewport.removeEventListener("pagehide", pause);
    page.removeEventListener("freeze", pause);
    pause();
  };
}
