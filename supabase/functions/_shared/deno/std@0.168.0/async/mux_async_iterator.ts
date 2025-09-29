// Simplified mux async iterator that performs round-robin iteration over multiple async iterators.
export class MuxAsyncIterator<T> implements AsyncIterableIterator<T> {
  #queue: AsyncIterator<T>[] = [];

  add(source: AsyncIterable<T> | AsyncIterator<T>): void {
    const iterator = Symbol.asyncIterator in source
      ? (source as AsyncIterable<T>)[Symbol.asyncIterator]()
      : source as AsyncIterator<T>;
    this.#queue.push(iterator);
  }

  async next(): Promise<IteratorResult<T>> {
    while (this.#queue.length > 0) {
      const iterator = this.#queue.shift()!;
      const result = await iterator.next();
      if (!result.done) {
        this.#queue.push(iterator);
        return result;
      }
    }

    return { done: true, value: undefined as unknown as T };
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<T> {
    return this;
  }
}
