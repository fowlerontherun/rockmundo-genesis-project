/** Pure replay-time motion. No accumulated state: pausing and seeking are exact. */
export const smoothMotion = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Stylised syllables and breath breaks; deliberately not audio lip sync. */
export function vocalPhrase(seconds: number, phase: number) {
  const time = seconds + phase * .37;
  const phrase = ((time % 6.8) + 6.8) % 6.8;
  const singing = smoothMotion(phrase / .25) * (1 - smoothMotion((phrase - 5.25) / .65));
  const syllable = .25 + .5 * Math.pow(Math.sin(time * 8.3), 2) + .25 * Math.pow(Math.sin(time * 13.7 + .8), 2);
  return { singing, opening: singing * syllable, breath: 1 - singing };
}

const GESTURES = [
  [.42, 1.28, .24], [.52, 1.52, .16], [.16, 1.22, .31],
  [.32, 1.05, .30], [.12, 1.38, .26], [.43, 1.12, .33],
] as const;

export function singerGesture(seconds: number, phase: number): [number, number, number] {
  const cue = Math.max(0, seconds + phase) / 3.6;
  const index = Math.floor(cue) % GESTURES.length;
  const from = GESTURES[index], to = GESTURES[(index + 1) % GESTURES.length];
  const blend = smoothMotion(((cue % 1) - .68) / .32);
  return [0, 1, 2].map(axis => from[axis] + (to[axis] - from[axis]) * blend) as [number, number, number];
}

/** Chord changes slide between held fret positions, rather than wandering constantly. */
export function fretPosition(seconds: number, bass: boolean) {
  const phrase = seconds / (bass ? 1.8 : 2.4);
  const notes = bass ? [.69, .75, .71, .77] : [.70, .75, .68, .73];
  const index = Math.floor(phrase) % notes.length;
  const blend = smoothMotion(((phrase % 1) - .82) / .18);
  return notes[index] + (notes[(index + 1) % notes.length] - notes[index]) * blend;
}
