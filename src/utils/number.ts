/**
 * Clamp a number to an inclusive range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamp gameplay percentage/state values that use a 0-100 range.
 */
export function clampPercent(value: number): number {
  return clamp(value, 0, 100);
}

/**
 * Clamp reputation-style scores that use a -100 to 100 range.
 */
export function clampScore(value: number): number {
  return clamp(value, -100, 100);
}
