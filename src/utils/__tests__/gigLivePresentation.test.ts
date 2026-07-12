import { describe, expect, it } from 'vitest';
import type { GigLiveSegment, LiveGigSessionState } from '../gigLive';
import { buildLiveGigPresentationState, buildStageLayout, calculateCrowdDensity, mapCrowdEnergyToPresentation, mapLightingState, mapProductionPlanToVisualEffects, mapVenueToTier } from '../gigLivePresentation';

const session: LiveGigSessionState = { gigId: 'gig-1', bandId: 'band-1', status: 'live', startedAt: '2026-01-01T20:00:00Z', currentSegmentIndex: 1, crowdEnergy: 74, fanSatisfaction: 68, performanceQuality: 70, bandStamina: 82, momentum: 5, incidentRisk: 12, simulationVersion: 1 };
const segments: GigLiveSegment[] = [
  { segmentIndex: 0, segmentType: 'intro', plannedStartAt: session.startedAt, plannedDurationSeconds: 90, status: 'resolved' },
  { segmentIndex: 1, segmentType: 'song', songId: 'song-1', plannedStartAt: session.startedAt, plannedDurationSeconds: 210, status: 'active' },
  { segmentIndex: 2, segmentType: 'outro', plannedStartAt: session.startedAt, plannedDurationSeconds: 90, status: 'pending' },
];

describe('gig live presentation mapping', () => {
  it('builds deterministic song presentation state from authoritative live values', () => {
    const input = { session, segments, venue: { name: 'Ruby Club', capacity: 300, attendance: 240 }, production: { lightingPackage: 'cool led', effects: ['haze', 'confetti'] }, performers: [{ id: 'p1', name: 'Ari', role: 'lead vocalist', instrument: 'microphone', isLead: true }, { id: 'p2', name: 'Bo', role: 'drummer', instrument: 'drums' }], currentSong: { id: 'song-1', title: 'Neon Hearts', genre: 'rock', tempo: 142, popularity: 78 } };
    expect(buildLiveGigPresentationState(input)).toEqual(buildLiveGigPresentationState(input));
    const state = buildLiveGigPresentationState(input);
    expect(state.scene).toBe('song');
    expect(state.crowdState).toBe('clapping');
    expect(state.venueTier).toBe('local_club');
    expect(state.activeEffects).toEqual(['haze', 'confetti']);
    expect(state.performerStates[0]).toMatchObject({ x: 50, y: 70, instrumentLabel: 'Microphone' });
    expect(state.performerStates[1]).toMatchObject({ x: 50, y: 32, instrumentLabel: 'Drum kit' });
  });

  it('maps crowd energy and attendance density without overfilling low-attendance gigs', () => {
    expect(mapCrowdEnergyToPresentation(18, 10, 200)).toBe('sparse');
    expect(mapCrowdEnergyToPresentation(95, 195, 200)).toBe('ecstatic');
    expect(calculateCrowdDensity(10, 200)).toBe(5);
    expect(calculateCrowdDensity(250, 200)).toBe(96);
  });

  it('supports venue tiers and reusable band-size layouts', () => {
    expect(mapVenueToTier({ capacity: 90 })).toBe('small_bar');
    expect(mapVenueToTier({ capacity: 18000 })).toBe('arena');
    expect(mapVenueToTier({ capacity: 40000, isFestival: true })).toBe('festival_stage');
    expect(buildStageLayout([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }])).toBe('three_piece');
    expect(buildStageLayout(new Array(7).fill(null).map((_, i) => ({ id: String(i), name: `P${i}` })))).toBe('six_plus');
  });

  it('respects production incidents and reduced motion for lighting and effects', () => {
    const incident = { incidentType: 'production_cue_failure', category: 'production' as const, severity: 'moderate' as const, title: 'Lighting cue fails', generationSnapshot: {}, resultSnapshot: {} };
    const base = { session, segments, incidents: [incident], currentSong: { title: 'Ballad', tempo: 70 }, production: { lightingPackage: 'dramatic', effects: ['haze', 'pyro_burst', 'projection'] } };
    expect(mapLightingState(base, 'song')).toBe('failure_state');
    expect(mapProductionPlanToVisualEffects(base.production, [incident], 'song', true)).toEqual(['haze', 'projection']);
  });

  it('surfaces decisions, fallback copy, and incident-affected performers', () => {
    const state = buildLiveGigPresentationState({ session: { ...session, status: 'paused_for_decision' }, segments, activeDecision: { decisionType: 'equipment_response', deadlineSeconds: 420, recommendedFallback: 'use_spare', options: [] }, incidents: [{ incidentType: 'equipment_fault', category: 'equipment', severity: 'major', title: 'Amp failure', generationSnapshot: {}, resultSnapshot: {} }], performers: [{ id: 'g', name: 'Gale', instrument: 'electric guitar' }] });
    expect(state.scene).toBe('decision');
    expect(state.headline).toBe('Tactical decision available');
    expect(state.performerStates[0].visualState).toBe('incident_affected');
    expect(state.commentary.join(' ')).toContain('Decision fallback');
  });
});
