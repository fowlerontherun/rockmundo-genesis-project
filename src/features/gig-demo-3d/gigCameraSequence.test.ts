import { describe, expect, it } from 'vitest';
import { directGigCamera, GIG_CAMERA_SHOT_SECONDS } from './gigCameraSequence';

describe('deterministic gig camera grammar', () => {
  it('starts wide and includes more than six distinct stage perspectives', () => {
    const shots = Array.from({ length: 8 }, (_, index) =>
      directGigCamera(index * GIG_CAMERA_SHOT_SECONDS, 'verse', .35, false, false));
    expect(shots[0]).toBe('front');
    expect(new Set(shots).size).toBe(8);
    expect(shots).toContain('side_pit');
    expect(shots).toContain('side_stage');
    expect(shots).toContain('crane');
  });

  it('returns to a performer close-up regularly in large arenas, stadiums and festivals', () => {
    const close = new Set(['lead_close', 'guitar', 'drums', 'side_pit']);
    const shots = Array.from({ length: 50 }, (_, index) =>
      directGigCamera(index * GIG_CAMERA_SHOT_SECONDS, 'chorus', .4, true, false));
    expect(shots[1]).toBe('lead_close');
    for (let index = 0; index <= shots.length - 4; index++) {
      expect(shots.slice(index, index + 4).some(shot => close.has(shot))).toBe(true);
    }
  });

  it('is replay-time derived after backwards seeks and at shot boundaries', () => {
    const at = (seconds: number) => directGigCamera(seconds, 'verse', .2, true, false);
    const before = at(9 - .001), after = at(9), later = at(137);
    expect(before).toBe('front');
    expect(after).toBe('lead_close');
    expect(at(0)).toBe('front');
    expect(at(137)).toBe(later);
    expect(at(9)).toBe(after);
    expect(at(Number.NaN)).toBe('front');
  });

  it('respects reduced motion, solo focus and the closing release shot', () => {
    expect(directGigCamera(100, 'solo', .7, true, false)).toBe('guitar');
    expect(directGigCamera(100, 'release', .25, true, false)).toBe('front');
    expect(directGigCamera(100, 'release', .75, true, false)).toBe('stage');
    expect(directGigCamera(100, 'solo', .75, true, true)).toBe('front');
  });
});
