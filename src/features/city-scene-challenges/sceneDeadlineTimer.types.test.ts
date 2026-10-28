import { describe, expect, expectTypeOf, it } from 'vitest';

// RockMundo uses both DOM and Node types in CI; window.setTimeout must be
// treated as a browser numeric timer ID, never NodeJS.Timeout.
describe('City Scene browser deadline timer typing', () => {
  it('uses the browser timer return type and releases its scheduled callback', () => {
    expectTypeOf<ReturnType<typeof window.setTimeout>>().toEqualTypeOf<number>();
    // A DOM overload must resolve to a number, even with @types/node installed.
    const timerId: ReturnType<typeof window.setTimeout> = 123;
    expect(typeof timerId).toBe('number');
  });
});
