import type { PerformanceSection } from './liveTypes';

const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
/** Shared 120-BPM-equivalent seconds; never integrate frame deltas. */
export function rhythmSeconds(seconds: number, songStart = 0, bpm: unknown = 120): number {
  const tempo = typeof bpm === 'number' && Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? bpm : 120;
  return Math.max(0, Number.isFinite(seconds) ? seconds - songStart : 0) * tempo / 120;
}
export interface CrowdTransition { previousReaction?: string; reactionElapsed?: number; rhythmSeconds?: number }
export function reactionBlend(elapsed: number | undefined, personality: number): number {
  return elapsed === undefined ? 1 : ease((elapsed - personality * .22) / .65);
}
/** A raised-arm pocket travels left to right; nobody changes position. */
export function waveAmount(seconds: number, x: number, width: number): number {
  const phase = ((seconds - (x / Math.max(1, width) + .5) * 3) % 6 + 6) % 6;
  return ease(phase / .4) * (1 - ease((phase - .85) / .6));
}
export function sectionLight(section: PerformanceSection | undefined, progress = 0) {
  switch (section) {
    case 'idle': return { intensity: .45, spread: .45 };
    case 'verse': return { intensity: .72, spread: .6 };
    case 'breakdown': return { intensity: .5, spread: .35 };
    case 'solo': return { intensity: .85, spread: .3 };
    case 'chorus': return { intensity: 1 + .15 * ease(progress / .12), spread: 1 };
    case 'outro': return { intensity: 1 - .2 * ease(progress), spread: .9 };
    case 'release': return { intensity: 1 - .35 * ease(progress), spread: .7 };
    default: return { intensity: .85, spread: .75 };
  }
}
