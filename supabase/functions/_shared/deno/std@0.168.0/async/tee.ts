// Minimal tee helper that duplicates values from an async iterable to two consumers.
export function tee<T>(iterable: AsyncIterable<T>): [AsyncIterableIterator<T>, AsyncIterableIterator<T>] {
  const iterator = iterable[Symbol.asyncIterator]();
  const buffers: T[][] = [[], []];
  const waiters: Array<Array<(result: IteratorResult<T>) => void>> = [[], []];
  let finished = false;
  let finalResult: IteratorResult<T> | null = null;
  let pumping = false;

  const pump = async () => {
    if (pumping || finished) {
      return;
    }
    pumping = true;
    try {
      const result = await iterator.next();
      if (result.done) {
        finished = true;
        finalResult = result;
      } else {
        buffers[0].push(result.value);
        buffers[1].push(result.value);
      }
      for (const index of [0, 1] as const) {
        const waiter = waiters[index].shift();
        if (!waiter) continue;
        if (buffers[index].length > 0) {
          const value = buffers[index].shift() as T;
          waiter({ value, done: false });
        } else {
          waiter(finalResult ?? { done: true, value: undefined as unknown as T });
        }
      }
    } finally {
      pumping = false;
    }
  };

  const createIterator = (index: 0 | 1): AsyncIterableIterator<T> => ({
    async next(): Promise<IteratorResult<T>> {
      if (buffers[index].length > 0) {
        const value = buffers[index].shift() as T;
        return { value, done: false };
      }

      if (finished) {
        return finalResult ?? { done: true, value: undefined as unknown as T };
      }

      return await new Promise<IteratorResult<T>>((resolve) => {
        waiters[index].push(resolve);
        void pump();
      });
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  });

  return [createIterator(0), createIterator(1)];
}
