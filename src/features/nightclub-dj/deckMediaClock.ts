import type { DjVolumeFrameScheduler } from "./djVolumeRamp";

/**
 * Native media elements fire timeupdate only a few times per second. Keep the
 * playhead, illustrative waveform position and BPM-only beat guide aligned to
 * the ACTUAL playback position without estimating elapsed song time.
 *
 * This is presentation-only; it never generates verified DJ interactions.
 * The existing timeupdate handler remains the fallback without animation frames.
 */
export const DJ_PLAYHEAD_REFRESH_MS = 80;

export function watchDjDeckMediaTime(
  media: Pick<HTMLMediaElement, "currentTime" | "paused">,
  clock: DjVolumeFrameScheduler | null,
  publish: (currentTime: number) => void,
  cadenceMs = DJ_PLAYHEAD_REFRESH_MS,
): () => void {
  if (!clock || media.paused) return () => undefined;

  const cadence = Number.isFinite(cadenceMs) && cadenceMs > 0
    ? cadenceMs : DJ_PLAYHEAD_REFRESH_MS;
  let cancelled = false;
  let frameId: number | null = null;
  let lastPublishedAt = clock.now();

  const reportActualMediaTime = () => {
    const currentTime = media.currentTime;
    if (Number.isFinite(currentTime) && currentTime >= 0) publish(currentTime);
  };

  // First paint should already show the correct seek/cue location.
  reportActualMediaTime();
  const frame = (timestamp: number) => {
    frameId = null;
    if (cancelled || media.paused) return;
    if (Number.isFinite(timestamp) && timestamp - lastPublishedAt >= cadence) {
      lastPublishedAt = timestamp;
      reportActualMediaTime();
    }
    frameId = clock.request(frame);
  };
  frameId = clock.request(frame);

  return () => {
    cancelled = true;
    if (frameId !== null) clock.cancel(frameId);
  };
}
