import { describe, expect, it } from 'vitest';
import { rhythmSeconds, reactionBlend, waveAmount, sectionLight } from './showMotion';
import { directGigCamera } from './gigCameraSequence';
import { venueBeamCue } from './venueLightShow';
import { resolveVenueProfile } from './venueProfile';

describe('replay-time concert direction', () => {
  it('shares a beat clock with bounded BPM and a stable legacy fallback', () => {
    expect(rhythmSeconds(12, 10, 60)).toBe(1);
    expect(rhythmSeconds(12, 10, 180)).toBe(3);
    for (const bpm of [undefined, NaN, Infinity, 0, 900, '120']) expect(rhythmSeconds(12, 10, bpm)).toBe(2);
    expect(rhythmSeconds(-2)).toBe(0);
    expect(rhythmSeconds(NaN)).toBe(0);
  });
  it('stagger reactions and settles them without accumulated frame state', () => {
    expect(reactionBlend(0, .5)).toBe(0);
    expect(reactionBlend(.3, 0)).toBeGreaterThan(reactionBlend(.3, 1));
    expect(reactionBlend(1, 1)).toBe(1);
    const before = reactionBlend(.25, .4);
    reactionBlend(20, .4);
    expect(reactionBlend(.25, .4)).toBe(before);
  });
  it('moves a bounded wave across the audience and repeats deterministically', () => {
    expect(waveAmount(1, -6, 12)).toBeGreaterThan(.5);
    expect(waveAmount(1, 6, 12)).toBe(0);
    for (let t = 0; t < 20; t += .1) {
      expect(waveAmount(t, 2, 12)).toBeGreaterThanOrEqual(0);
      expect(waveAmount(t, 2, 12)).toBeLessThanOrEqual(1);
      expect(waveAmount(t + 6, 2, 12)).toBeCloseTo(waveAmount(t, 2, 12));
    }
  });
  it('directs chorus entrances, breakdowns and endings, respecting reduced motion', () => {
    expect(directGigCamera(45, 'chorus', .01, true, false)).toBe('side_pit');
    expect(directGigCamera(45, 'chorus', .01, false, false)).toBe('band_medium');
    expect(directGigCamera(45, 'breakdown', .5, false, false)).toBe('drums');
    expect(directGigCamera(45, 'outro', .95, false, false)).toBe('band_medium');
    expect(directGigCamera(45, 'chorus', .01, true, true)).toBe('front');
  });
  it('opens chorus lighting and directs the first two solo lamps at the featured musician', () => {
    expect(sectionLight('chorus', .5).intensity).toBeGreaterThan(sectionLight('verse').intensity);
    const p = resolveVenueProfile({ type: 'arena', capacity: 12000 });
    const focus = [1, p.stageHeight, -2] as const;
    const solo = venueBeamCue(p, [0, 6, -3], 0, 20, 1, false, 'solo', .5, focus);
    expect(solo.target).toEqual([1, p.stageHeight + .9, -2]);
    expect(venueBeamCue(p, [0, 6, -3], 2, 20, 1, false, 'solo', .5, focus).target).not.toEqual(solo.target);
  });
});
