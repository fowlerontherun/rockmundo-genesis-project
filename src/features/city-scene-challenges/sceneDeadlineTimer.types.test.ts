import { describe, expect, expectTypeOf, it } from 'vitest';

// RockMundo uses both DOM and Node types in CI; window.setTimeout must be
// treated as a browser numeric timer ID, never NodeJS.Timeout.
describe('City Scene browser deadline timer typing', () => {
  it('uses the browser timer return type and releases its scheduled callback', () => {
    expectTypeOf<ReturnType<typeof window.setTimeout>>().toEqualTypeOf<number>();
    const timer: ReturnType<typeof window.setTimeout> = window.setTimeout(() => {}, 1000);
    expect(typeof timer).toBe('number');
    window.clearTimeout(timer);
  });
});
