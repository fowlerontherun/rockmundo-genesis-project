import { describe, expect, it } from 'vitest';
import { frameTvPerformance, studioPerformerMotion, TV_PERFORMANCE_SHOTS } from './tvPerformanceDirection';
import { resolveTotpStudioStageGeometry, totpStudioSafeContains } from './totpStudioGeometry';
import { resolveVenueProfile } from './venueProfile';
import type { Point3 } from './venueCameraAngles';

const venue = resolveVenueProfile({ type: 'tv_studio' });
const stages = ['main_stage', 'stage_b', 'rock_stage', 'studio_floor'] as const;

describe('replay-time television performance direction', () => {
  it('offers twelve distinct performance views including both instrument sides and an orbit', () => {
    expect(new Set(TV_PERFORMANCE_SHOTS).size).toBe(12);
    expect(TV_PERFORMANCE_SHOTS).toContain('tv_instrument_right');
    expect(TV_PERFORMANCE_SHOTS).toContain('tv_band_two');
    expect(TV_PERFORMANCE_SHOTS).toContain('tv_orbit');
  });

  it.each(stages)('%s has moving, finite, subject-safe cameras on wide and narrow screens', stage => {
    const g = resolveTotpStudioStageGeometry(stage, venue);
    const subject: Point3 = [g.centerX + .3, g.floorY, g.centerZ];
    for (const aspect of [.55, 1, 1.78, 2.5]) {
      for (const shot of TV_PERFORMANCE_SHOTS) {
        const start = frameTvPerformance(shot, g, subject, 0, aspect);
        const end = frameTvPerformance(shot, g, subject, 1, aspect);
        if (!start || !end) throw new Error('Missing television camera');
        expect([...start.position, ...start.target, start.fov].every(Number.isFinite)).toBe(true);
        expect(start.position).not.toEqual(end.position);
        expect(Math.hypot(...start.position.map((value, i) => value - start.target[i]))).toBeGreaterThan(2.8);
        expect(start.target[0]).toBeGreaterThan(g.centerX - g.safeWidth / 2);
        expect(start.target[0]).toBeLessThan(g.centerX + g.safeWidth / 2);
        expect(frameTvPerformance(shot, g, subject, .42, aspect)).toEqual(frameTvPerformance(shot, g, subject, .42, aspect));
        expect(frameTvPerformance(shot, g, subject, 0, aspect, true)).toEqual(frameTvPerformance(shot, g, subject, 1, aspect, true));
      }
    }
  });

  it('actually pushes in and pulls back, retaining subject-centred phone framing', () => {
    const g = resolveTotpStudioStageGeometry('rock_stage', venue);
    const subject: Point3 = [g.centerX, g.floorY, g.centerZ];
    const distance = (shot: 'tv_push_in' | 'tv_pull_back', progress: number) => {
      const pose = frameTvPerformance(shot, g, subject, progress, 1.78);
      if (!pose) throw new Error('Missing shot');
      return pose.position[2] - pose.target[2];
    };
    expect(distance('tv_push_in', 1)).toBeLessThan(distance('tv_push_in', 0));
    expect(distance('tv_pull_back', 1)).toBeGreaterThan(distance('tv_pull_back', 0));
    expect(frameTvPerformance('tv_lead_close', g, subject, .5, .55)?.target).toEqual(
      frameTvPerformance('tv_lead_close', g, subject, .5, 1.78)?.target);
    expect(frameTvPerformance('tv_presenter_close', g, subject, .5, 1.78)).toBeNull();
  });

  it.each(stages)('%s confines small steps to the safe pocket and preserves equipment anchors', stage => {
    const g = resolveTotpStudioStageGeometry(stage, venue);
    for (const x of [-.5, 0, .5]) for (const z of [-.5, 0, .5]) {
      const base: Point3 = [g.centerX + x * g.safeWidth, g.floorY, g.centerZ + z * g.safeDepth];
      for (let t = 0; t < 120; t += .7) {
        const move = studioPerformerMotion(base, g, t, 2, 1, 'chorus', false, false);
        expect(totpStudioSafeContains(stage, venue, base[0] + move.dx, base[2] + move.dz)).toBe(true);
        expect(Math.abs(move.dx)).toBeLessThanOrEqual(.161);
        expect(Math.abs(move.dz)).toBeLessThanOrEqual(.121);
      }
      const still = { dx: 0, dz: 0, yaw: 0 };
      expect(studioPerformerMotion(base, g, 8, 2, 1, 'chorus', true, false)).toEqual(still);
      expect(studioPerformerMotion(base, g, 8, 2, 1, 'chorus', false, true)).toEqual(still);
      expect(studioPerformerMotion(base, g, 8, 2, 1, 'release', false, false)).toEqual(still);
      expect(studioPerformerMotion(base, g, 8, 2, 1, 'chorus', false, false)).toEqual(
        studioPerformerMotion(base, g, 8, 2, 1, 'chorus', false, false));
    }
  });
});