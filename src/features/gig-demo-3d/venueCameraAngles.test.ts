import { describe, expect, it } from 'vitest';
import { frameVenuePerformer } from './venueCameraAngles';
import { directGigCamera, GIG_CAMERA_SHOT_SECONDS } from './gigCameraSequence';
import { SHOTS } from './config';
import { resolveVenueProfile, stagePosition, VENUE_TYPES, type VenueKind } from './venueProfile';

describe('new live-gig close-up and audience-reverse views', () => {
  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s frames its actual stage performer safely on desktop and narrow phones', kind => {
    const p = resolveVenueProfile({ type: kind });
    const musician = stagePosition(p, .67, .62);
    for (const aspect of [.55, .68, 1, 1.8, 2.5]) {
      const bass = frameVenuePerformer(p, 'bass_close', musician, aspect);
      const reverse = frameVenuePerformer(p, 'backline_reverse', musician, aspect);
      for (const shot of [bass, reverse]) {
        expect([...shot.target, ...shot.position, shot.fov].every(Number.isFinite)).toBe(true);
        expect(shot.position[0]).toBeGreaterThanOrEqual(-p.stageWidth / 2 + .2);
        expect(shot.position[0]).toBeLessThanOrEqual(p.stageWidth / 2 - .2);
      }
      expect(bass.target[0]).toBeCloseTo(musician[0]);
      expect(bass.position[2] - musician[2]).toBeGreaterThanOrEqual(2.84);
      expect(bass.position[1]).toBeGreaterThan(musician[1]);
      expect(bass.fov).toBe(37);
      expect(reverse.position[2]).toBeGreaterThan(.65 - p.stageDepth * .7);
      expect(reverse.position[2]).toBeLessThan(musician[2]);
      expect(reverse.target[2]).toBeGreaterThan(.65);
      expect(reverse.position[1]).toBeLessThan(p.outdoor ? p.rigHeight : p.roofHeight);
      expect(reverse.fov).toBe(54);
    }
  });

  it('keeps phone close-ups subject-centred rather than turning them into stadium-wide shots', () => {
    const p = resolveVenueProfile({ type: 'stadium', capacity: 65000 });
    const bassist = stagePosition(p, .68, .55);
    const phone = frameVenuePerformer(p, 'bass_close', bassist, .6);
    const desktop = frameVenuePerformer(p, 'bass_close', bassist, 1.78);
    expect(phone.position[2] - phone.target[2]).toBeGreaterThan(desktop.position[2] - desktop.target[2]);
    expect(phone.position[2] - phone.target[2]).toBeLessThan(6);
    expect(phone.position[0] - phone.target[0]).toBeCloseTo(desktop.position[0] - desktop.target[0]);
  });

  it('places the reverse lens in front of the main LED wall so the screen cannot occlude the band', () => {
    for (const kind of ['live_house', 'indoor_arena', 'stadium', 'festival_stage'] as const) {
      const p = resolveVenueProfile({ type: kind });
      const performer = stagePosition(p, .52, .62);
      const lens = frameVenuePerformer(p, 'backline_reverse', performer, 1.77);
      const rearScreenZ = .65 - p.stageDepth + .3;
      expect(lens.position[2]).toBeGreaterThan(rearScreenZ);
      expect(lens.position[2]).toBeLessThan(performer[2]);
      expect(lens.target[2]).toBeGreaterThan(.65);
      expect(lens.position[1]).toBeGreaterThan(p.stageHeight + 1);
    }
  });

  it('uses no random state: seeking back, resizing, and requesting the same performer restore the same framing', () => {
    const p = resolveVenueProfile({ type: 'stadium', seed: 913 });
    const musician = stagePosition(p, .31, .56);
    const a = frameVenuePerformer(p, 'bass_close', musician, 1.6);
    const b = frameVenuePerformer(p, 'bass_close', musician, 1.6);
    expect(a).toEqual(b);
    const stageA = frameVenuePerformer(p, 'backline_reverse', musician, 1.6);
    const stageB = frameVenuePerformer(p, 'backline_reverse', musician, 1.6);
    expect(stageA).toEqual(stageB);
    expect(frameVenuePerformer(p, 'bass_close', musician, Number.NaN)).toEqual(
      frameVenuePerformer(p, 'bass_close', musician, 1),
    );
  });
});

describe('automatic director and manual control discoverability', () => {
  it('offers both cameras directly to players', () => {
    expect(SHOTS.filter(shot => shot.id === 'bass_close')).toEqual([{ id: 'bass_close', label: 'Bass close-up' }]);
    expect(SHOTS.filter(shot => shot.id === 'backline_reverse')).toEqual([{ id: 'backline_reverse', label: 'Backline to crowd' }]);
    expect(new Set(SHOTS.map(shot => shot.id)).size).toBe(SHOTS.length);
  });

  it('features both new views on regular gigs and repeats close-ups through large-venue shows', () => {
    const standard = Array.from({ length: 10 }, (_, i) =>
      directGigCamera(i * GIG_CAMERA_SHOT_SECONDS, 'verse', .45, false, false));
    const large = Array.from({ length: 36 }, (_, i) =>
      directGigCamera(i * GIG_CAMERA_SHOT_SECONDS, 'chorus', .5, true, false));
    expect(standard).toContain('bass_close');
    expect(standard).toContain('backline_reverse');
    expect(large).toContain('bass_close');
    expect(large).toContain('backline_reverse');
    const close = new Set(['lead_close', 'bass_close', 'guitar', 'drums', 'side_pit']);
    for (let index = 0; index < large.length - 3; index++)
      expect(large.slice(index, index + 4).some(shot => close.has(shot))).toBe(true);
    expect(directGigCamera(9 * 3, 'verse', .3, true, true)).toBe('front');
    expect(directGigCamera(35, 'release', .7, true, false)).toBe('stage');
    expect(directGigCamera(9 * 3, 'verse', .3, true, false)).toBe('bass_close');
  });
});
