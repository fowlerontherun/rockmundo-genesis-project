import { delay } from "./delay.ts";

export interface RetryOptions {
  maxAttempts?: number;
  maxTimeout?: number;
  multiplier?: number;
  minTimeout?: number;
  signal?: AbortSignal;
  onRetry?: (error: unknown, attempt: number) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, minTimeout = 100, multiplier = 2, maxTimeout, signal, onRetry }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  let delayMs = Math.max(0, minTimeout);

  while (true) {
    if (signal?.aborted) {
      throw new DOMException("Retry aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts) {
        throw error;
      }

      onRetry?.(error, attempt);

      await delay(delayMs, { signal });
      const nextDelay = delayMs * multiplier;
      delayMs = typeof maxTimeout === "number" ? Math.min(maxTimeout, nextDelay) : nextDelay;
    }
  }
}
