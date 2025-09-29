// Minimal implementation of std/async/deferred.ts used for local development.
export interface Deferred<T> extends Promise<T> {
  readonly promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const basePromise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const enhancedPromise = basePromise as Deferred<T>;
  (enhancedPromise as { promise: Promise<T> }).promise = basePromise;
  enhancedPromise.resolve = resolve;
  enhancedPromise.reject = reject;

  return enhancedPromise;
}
