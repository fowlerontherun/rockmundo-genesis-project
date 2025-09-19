import { lazy, type ComponentType } from "react";

const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed"
];

const isChunkLoadError = (error: unknown) => {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
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
          continue;
        }

        if (typeof window !== "undefined") {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("forceReload", Date.now().toString());
          window.location.replace(currentUrl.toString());
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to load chunk");
  });
};

