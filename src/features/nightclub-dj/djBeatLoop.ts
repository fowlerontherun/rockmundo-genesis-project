/**
 * Local-only HTML audio looping for DJ deck practice and performance.
 * The segment is measured from the real source-media time and catalogue BPM.
 * It is NOT beat/downbeat detection, cannot certify a match and awards nothing.
 */
export type DjBeatLoop = Readonly<{
  start: number;
  end: number;
  beats: 4 | 8;
}>;

export function createDjBeatLoop(
  mediaSeconds: number,
  sourceBpm: number | null,
  beats: 4 | 8,
  durationSeconds: number,
): DjBeatLoop | null {
  if (!Number.isFinite(mediaSeconds) || mediaSeconds < 0 ||
      sourceBpm === null || !Number.isFinite(sourceBpm) ||
      sourceBpm < 30 || sourceBpm > 300 ||
      (beats !== 4 && beats !== 8) ||
      !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  // The final margin prevents an audio element ending before the loop wraps.
  const end = mediaSeconds + (60 / sourceBpm) * beats;
  if (end > durationSeconds - 0.15) return null;
  return { start: mediaSeconds, end, beats };
}

/** Return the existing real-media loop start only after its end is reached. */
export function wrapDjBeatLoopTime(
  mediaSeconds: number,
  loop: DjBeatLoop | null,
): number | null {
  if (!loop || !Number.isFinite(mediaSeconds) || mediaSeconds < 0 ||
      !Number.isFinite(loop.start) || !Number.isFinite(loop.end) ||
      loop.start < 0 || loop.end <= loop.start) return null;
  return mediaSeconds >= loop.end ? loop.start : null;
}

/** A manual seek outside the loop exits, instead of unexpectedly jumping back. */
export function djBeatLoopSeekExits(
  mediaSeconds: number,
  loop: DjBeatLoop | null,
): boolean {
  return Boolean(loop && Number.isFinite(mediaSeconds) &&
    (mediaSeconds < loop.start - 0.05 || mediaSeconds > loop.end + 0.05));
}
