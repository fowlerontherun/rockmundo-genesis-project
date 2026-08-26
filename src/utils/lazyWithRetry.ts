import { lazy, type ComponentType } from "react";

const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed"
];

const CHUNK_RELOAD_GUARD_KEY = "rockmundo:chunk-reload-attempted-at";
const CHUNK_RELOAD_GUARD_MS = 10 * 60 * 1000;

const isChunkLoadError = (error: unknown) => {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const wait = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

const canAttemptRecoveryReload = () => {
  if (typeof window === "undefined") return false;

  try {
    const previousAttempt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY));
    if (Number.isFinite(previousAttempt) && Date.now() - previousAttempt < CHUNK_RELOAD_GUARD_MS) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()));
    return true;
  } catch {
    // If session storage is unavailable, do not risk an uncontrolled reload loop.
    return false;
  }
};

type LazyImport<T extends ComponentType<unknown>> = () => Promise<{ default: T }>;

interface LazyWithRetryOptions {
  retries?: number;
  retryDelayMs?: number;
}

export const lazyWithRetry = <T extends ComponentType<unknown>>(
  importer: LazyImport<T>,
  { retries = 3, retryDelayMs = 500 }: LazyWithRetryOptions = {}
) => {
  return lazy(async () => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < retries) {
      try {
        return await importer();
      } catch (error) {
        lastError = error;
        attempt += 1;

        if (!isChunkLoadError(error)) {
          throw error;
        }

        if (attempt < retries) {
          await wait(retryDelayMs * attempt);
          continue;
        }

        // A stale deployment can legitimately require one refresh, but repeated
        // chunk failures must surface as an error instead of continually
        // interrupting the player with full-page reloads.
        if (canAttemptRecoveryReload()) {
          window.location.reload();
          return new Promise<never>(() => undefined);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to load chunk");
  });
};
