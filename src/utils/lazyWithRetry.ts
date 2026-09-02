import { lazy, type ComponentType } from "react";

const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed"
];

const CHUNK_RELOAD_KEY_PREFIX = "rockmundo:chunk-reload:";

const isChunkLoadError = (error: unknown) => {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const getChunkFailureId = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const urlMatch = message.match(/https?:\/\/\S+\.js(?:\?\S*)?/i);
  return urlMatch?.[0] ?? message;
};

const reloadOnceForStaleChunk = (error: unknown) => {
  if (typeof window === "undefined") {
    return false;
  }

  const failureId = getChunkFailureId(error);
  const reloadKey = `${CHUNK_RELOAD_KEY_PREFIX}${failureId}`;

  try {
    if (window.sessionStorage.getItem(reloadKey)) {
      return false;
    }

    window.sessionStorage.setItem(reloadKey, "1");
  } catch {
    // If session storage is unavailable, do not risk an uncontrolled reload loop.
    return false;
  }

  window.location.reload();
  return true;
};

const wait = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

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
        }
      }
    }

    // A deployment can leave an already-open browser tab holding an old app shell
    // that references a hashed chunk which no longer exists on the CDN. Retrying
    // the same URL cannot recover from that state, so allow one guarded refresh for
    // this exact failed chunk. The sessionStorage marker prevents the recurring
    // reload behaviour that previously interrupted players during normal gameplay.
    if (isChunkLoadError(lastError) && reloadOnceForStaleChunk(lastError)) {
      return await new Promise<{ default: T }>(() => undefined);
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to load chunk");
  });
};
