import { focusManager, onlineManager } from "@tanstack/react-query";

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
 * Keeps long-lived RockMundo pages stable across browser/mobile lifecycle events.
 *
 * A game page can have many active TanStack queries. Browser focus and short
 * connectivity changes used to tell TanStack Query to refetch every stale query
 * at once. Even without a literal document reload, that can remount loading UI,
 * reset local state and look exactly like a whole-page refresh to the player.
 *
 * RockMundo already has explicit invalidation/realtime paths for game-state
 * changes, so global focus/reconnect driven refetching is intentionally disabled.
 */
export const configureStablePageLifecycle = () => {
  focusManager.setEventListener(() => () => undefined);
  onlineManager.setEventListener(() => () => undefined);

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
