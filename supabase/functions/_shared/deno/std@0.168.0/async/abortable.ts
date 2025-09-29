// Simplified abortable helper inspired by deno_std@0.168.0/async/abortable.ts
export async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    throw new DOMException("Operation was aborted", "AbortError");
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Operation was aborted", "AbortError"));
    };

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    promise.then((value) => {
      cleanup();
      resolve(value);
    }, (error) => {
      cleanup();
      reject(error);
    });

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
