// Simplified debounce utility similar to std/async/debounce.ts
export function debounce<F extends (...args: any[]) => void>(fn: F, wait: number): (...args: Parameters<F>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<F>) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      fn(...args);
    }, Math.max(0, wait));
  };
}
