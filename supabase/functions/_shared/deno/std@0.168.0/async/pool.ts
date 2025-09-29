// Minimal sequential pool helper matching the std/async/pool.ts signature.
export async function* pool<T, R>(
  _limit: number,
  iterable: AsyncIterable<T> | Iterable<T>,
  worker: (item: T) => R | Promise<R>,
): AsyncIterableIterator<R> {
  const iterator = Symbol.asyncIterator in (iterable as any)
    ? (iterable as AsyncIterable<T>)[Symbol.asyncIterator]()
    : (async function* () {
        for (const item of iterable as Iterable<T>) {
          yield item;
        }
      })();

  for await (const item of iterator) {
    yield await worker(item);
  }
}
