// Minimal implementation of std/async/delay.ts used for local development.
export interface DelayOptions {
  signal?: AbortSignal;
}

export function delay(ms: number, options: DelayOptions = {}): Promise<void> {
  const { signal } = options;

  if (signal?.aborted) {
    return Promise.reject(new DOMException("Delay was aborted", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Delay was aborted", "AbortError"));
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(0, ms));

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
