/** Accessible HTMLAudio mixing fallback for cross-origin and CORS-restricted
 * RockMundo songs. Do not require MediaElementAudioSourceNode: some game audio
 * sources lack WebAudio CORS headers and would otherwise become silent.
 *
 * The two decks already use equal-power fader targets capped at 70% volume.
 * Smooth the browser media elements independently but on the same frame clock
 * to avoid sharp volume changes when the crossfader moves.
 */
export const DJ_CROSSFADE_RAMP_MS = 90;

export interface DjVolumeFrameScheduler {
  now: () => number;
  request: (callback: (timestamp: number) => void) => number;
  cancel: (handle: number) => void;
}

function safeGain(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/** Returns a cancel function; the next drag starts at the last audible level.
 * No network calls, timers, gains above 1.0 or DOM state outside volume.
 */
export function rampDjDeckVolume(
  player: Pick<HTMLMediaElement, "volume" | "paused">,
  targetLevel: number,
  clock: DjVolumeFrameScheduler | null,
  durationMs = DJ_CROSSFADE_RAMP_MS,
): () => void {
  const target = safeGain(targetLevel);
  const startLevel = safeGain(player.volume);
  if (!clock || player.paused || !Number.isFinite(durationMs) ||
      durationMs <= 0 || Math.abs(startLevel - target) < .0001) {
    player.volume = target;
    return () => undefined;
  }
  const startedAt = clock.now();
  let frameId: number | null = null;
  let cancelled = false;
  const frame = (timestamp: number) => {
    if (cancelled) return;
    const progress = Math.max(0, Math.min(1, (timestamp - startedAt) / durationMs));
    // Smoothstep provides a bounded zero-slope start/end with no zipper noise.
    const eased = progress * progress * (3 - 2 * progress);
    player.volume = safeGain(startLevel + (target - startLevel) * eased);
    if (progress < 1) frameId = clock.request(frame);
    else frameId = null;
  };
  frameId = clock.request(frame);
  return () => {
    cancelled = true;
    if (frameId !== null) clock.cancel(frameId);
  };
}

/** Browser support check does not ever redirect/capture audio into a new
 * AudioContext, preserving safe playback of game and signed club tracks.
 */
export function browserDjVolumeClock(): DjVolumeFrameScheduler | null {
  if (typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function" ||
      typeof window.cancelAnimationFrame !== "function") return null;
  return {
    now: () => window.performance.now(),
    request: (callback) => window.requestAnimationFrame(callback),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  };
}
