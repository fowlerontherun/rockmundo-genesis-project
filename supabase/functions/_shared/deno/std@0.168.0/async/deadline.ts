// Simplified deadline helper matching the std/async/deadline API.
export interface DeadlineOptions {
  signal?: AbortSignal;
}

export function deadline<T>(promise: Promise<T>, ms: number, options: DeadlineOptions = {}): Promise<T> {
  const { signal } = options;
  const controller = new AbortController();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
    }
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort(new DOMException("Deadline exceeded", "TimeoutError"));
    }, Math.max(0, ms));

    const onAbort = () => {
      cleanup();
      reject(controller.signal.reason ?? new DOMException("Deadline exceeded", "TimeoutError"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    };

    controller.signal.addEventListener("abort", onAbort, { once: true });

    promise.then((value) => {
      cleanup();
      resolve(value);
    }, (error) => {
      cleanup();
      reject(error);
    });
  });
}
