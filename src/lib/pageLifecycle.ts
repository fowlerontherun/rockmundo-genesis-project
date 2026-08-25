import { focusManager } from "@tanstack/react-query";

const SCROLL_STORAGE_PREFIX = "rockmundo:scroll-position:";

const getScrollStorageKey = () =>
  `${SCROLL_STORAGE_PREFIX}${window.location.pathname}${window.location.search}`;

const readSavedScrollPosition = (): number | null => {
  try {
    const rawValue = window.sessionStorage.getItem(getScrollStorageKey());
    if (rawValue === null) return null;

    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
  } catch {
    return null;
  }
};

const saveScrollPosition = () => {
  try {
    window.sessionStorage.setItem(
      getScrollStorageKey(),
      String(window.scrollY),
    );
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
};

const restoreScrollPosition = () => {
  const savedPosition = readSavedScrollPosition();
  if (savedPosition === null) return;

  // Two animation frames gives React/router content a chance to render before
  // restoring the viewport after a browser tab has been discarded or revived.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedPosition, left: window.scrollX, behavior: "auto" });
    });
  });
};

/**
 * Keeps long-lived RockMundo pages stable across mobile/tab lifecycle events.
 *
 * TanStack Query refetches stale queries whenever a window regains focus by
 * default. In a large game screen that can look like a page reload and can
 * reset local UI state. We intentionally disable focus-driven refetches here;
 * queries will still refresh when mounted, explicitly invalidated, or after a
 * network reconnect.
 *
 * We also persist the current document scroll position in sessionStorage so a
 * browser/OS tab discard can restore the player near the same point after the
 * document is recreated.
 */
export const configureStablePageLifecycle = () => {
  focusManager.setEventListener(() => () => undefined);

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      saveScrollPosition();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", saveScrollPosition);
  window.addEventListener("pageshow", restoreScrollPosition);

  if (document.readyState === "complete") {
    restoreScrollPosition();
  } else {
    window.addEventListener("load", restoreScrollPosition, { once: true });
  }
};
