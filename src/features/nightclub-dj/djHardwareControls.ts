/** Local deck-pad controls. Hot cues are not server-verified mixer actions. */
export type DjHotCueSlots = readonly (number | null)[];

export function emptyDjHotCues(): DjHotCueSlots {
  return Array.from({ length: 8 }, () => null);
}

export function storeDjHotCue(
  previous: DjHotCueSlots,
  slot: number,
  seconds: number,
  duration: number,
): DjHotCueSlots {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 8 ||
      !Number.isFinite(seconds) || seconds < 0 ||
      !Number.isFinite(duration) || duration <= 0) return previous;
  const result = [...previous];
  result[slot] = Math.max(0, Math.min(seconds, duration));
  return result;
}

export function djHotCueSeek(
  cues: DjHotCueSlots,
  slot: number,
  duration: number,
): number | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 8 ||
      !Number.isFinite(duration) || duration <= 0) return null;
  const value = cues[slot];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.max(0, Math.min(value, duration))
    : null;
}

export function djJogSeek(
  current: number,
  deltaSeconds: number,
  duration: number,
): number | null {
  if (![current, deltaSeconds, duration].every(Number.isFinite) ||
      duration <= 0 || Math.abs(deltaSeconds) > 5) return null;
  return Math.max(0, Math.min(duration, current + deltaSeconds));
}
