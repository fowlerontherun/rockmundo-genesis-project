/**
 * Broadcast countdown helpers shared by the studio clock leader, the stage
 * transitions and the export lead-in. Pure functions so the timings can be
 * asserted without rendering anything.
 */

/** Length of the on-air clock leader played before the programme intro. */
export const TOTP_CLOCK_LEADER_MS = 5_000;
/** Lead-in counted down before the export recorder starts rolling. */
export const TOTP_EXPORT_LEAD_IN_MS = 3_000;

/** Remaining milliseconds of a countdown, clamped to the countdown window. */
export function totpCountdownRemainingMs(totalMs: number, elapsedMs: number): number {
  const total = Number.isFinite(totalMs) ? Math.max(0, totalMs) : 0;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.max(0, total - Math.min(total, elapsed));
}

/** Whole seconds still to run, counting 1 while any fraction of a second is left. */
export function totpCountdownSeconds(remainingMs: number): number {
  const remaining = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  return Math.ceil(remaining / 1_000);
}

/** Broadcast clock label, e.g. 0:04. */
export function formatTotpCountdown(remainingMs: number): string {
  const seconds = totpCountdownSeconds(remainingMs);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Eased 0-1 progress for transition animations. Cubic ease-in-out keeps camera
 * moves and fades from starting or stopping abruptly.
 */
export function totpEasedProgress(totalMs: number, elapsedMs: number): number {
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 1;
  const linear = Math.max(0, Math.min(1, (Number.isFinite(elapsedMs) ? elapsedMs : 0) / total));
  return linear < 0.5 ? 4 * linear ** 3 : 1 - (-2 * linear + 2) ** 3 / 2;
}

/**
 * Opacity of the fade-to-black tail used between segments: black at the very
 * start and the very end of a transition, clear in the middle.
 */
export function totpTransitionDipOpacity(totalMs: number, elapsedMs: number, tailMs = 450): number {
  const total = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 1;
  const elapsed = Math.max(0, Math.min(total, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const tail = Math.max(1, Math.min(tailMs, total / 2));
  if (elapsed < tail) return 1 - elapsed / tail;
  if (elapsed > total - tail) return 1 - (total - elapsed) / tail;
  return 0;
}
