/**
 * Manual BPM estimate using the HTML audio element's SOURCE-MEDIA seconds.
 * This keeps the estimate independent of the current playbackRate.
 * The player is tapping a beat; this is never audio analysis or score evidence.
 */
export function addDjSourceTempoTap(previous: readonly number[], mediaSeconds: number): number[] {
  if (!Number.isFinite(mediaSeconds) || mediaSeconds < 0) return [...previous];
  const last = previous[previous.length - 1];
  if (last === undefined) return [mediaSeconds];
  const interval = mediaSeconds - last;
  // Seek/loop rewind or a long break starts a new measurement. Ignore
  // double taps faster than 300 BPM instead of corrupting a good estimate.
  if (interval <= 0 || interval > 2.05) return [mediaSeconds];
  if (interval < 0.2) return [...previous];
  return [...previous, mediaSeconds].slice(-7);
}

export function estimateDjSourceBpmFromTaps(positions: readonly number[]): number | null {
  if (positions.length < 4) return null;
  const intervals = positions.slice(1).map((value, index) => value - positions[index]);
  if (intervals.some(value => !Number.isFinite(value) || value < 0.2 || value > 2.05)) return null;
  // Median of source clock intervals tolerates an occasional early/late tap.
  const sorted = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const bpm = Math.round(60 / median);
  return bpm >= 30 && bpm <= 300 ? bpm : null;
}
