import { describe, expect, it } from 'vitest';
import { applySongResultToSession, buildInitialLiveSession, buildLiveTimeline, buildTacticalDecision, canApplyLiveSetlistChange, canStartLiveGig, evaluateEncore, finalizeLiveGig, maybeGenerateLiveIncident, resolveLiveSong, type GigLiveContext } from '../gigLive';
import { calculateGigReadiness } from '../gigReadiness';

const readiness = calculateGigReadiness({ setlistSongs: [{ id: 'song-1', durationSeconds: 180, rehearsalLevel: 85 }, { id: 'song-2', durationSeconds: 210, rehearsalLevel: 90 }], bandChemistry: 78, fatigueScore: 80, healthScore: 82, assignedPerformers: 4, requiredPerformers: 4 });
const ctx: GigLiveContext = { gigId: 'gig-1', bandId: 'band-1', scheduledAt: '2026-07-11T12:00:00Z', capacity: 100, ticketsSold: 88, venueAcoustics: 72, venueQuality: 70, genreAffinity: 68, performerSkill: 76, stagePresence: 74, bandChemistry: 80, fatigueScore: 78, healthScore: 82, readiness, crew: [{ role: 'sound_engineer', workerType: 'npc_staff', relevantSkill: 80, attendance: 'confirmed', status: 'accepted' }], equipment: [{ equipmentRole: 'amplifier', quality: 82, condition: 86, isSpare: false }, { equipmentRole: 'amplifier', quality: 70, condition: 90, isSpare: true }], productionQuality: { score: 76, rating: 'impressive', audienceImpact: 12, reliability: 78, setupRisk: 16, costEfficiency: 70, factors: [] }, soundcheckType: 'full_production_soundcheck', setlist: [{ id: 'item-1', position: 1, song: { id: 'song-1', title: 'Opener', durationSeconds: 180, quality: 82, popularity: 78, familiarity: 88, tempo: 132, difficulty: 58, genre: 'rock' } }, { id: 'item-2', position: 2, song: { id: 'song-2', title: 'Closer', durationSeconds: 210, quality: 86, popularity: 84, familiarity: 90, tempo: 118, difficulty: 64, genre: 'rock' }, isEncore: true }] };

describe('gig live simulation', () => {
  it('starts eligible gigs once inputs are ready', () => {
    expect(canStartLiveGig(ctx, new Date('2026-07-11T12:01:00Z'))).toBe(true);
    expect(canStartLiveGig({ ...ctx, status: 'completed' }, new Date('2026-07-11T12:01:00Z'))).toBe(false);
    expect(canStartLiveGig({ ...ctx, setlist: [] }, new Date('2026-07-11T12:01:00Z'))).toBe(false);
  });

  it('generates a stable persisted timeline with encore and transitions', () => {
    const first = buildLiveTimeline(ctx, new Date('2026-07-11T12:00:00Z'));
    const second = buildLiveTimeline(ctx, new Date('2026-07-11T12:00:00Z'));
    expect(first).toEqual(second);
    expect(first.map(s => s.segmentType)).toEqual(['intro', 'song', 'transition', 'encore_break', 'encore_song', 'outro']);
  });

  it('resolves songs deterministically and persists bounded state changes', () => {
    const session = buildInitialLiveSession(ctx, new Date('2026-07-11T12:00:00Z'));
    const result = resolveLiveSong(ctx, session, ctx.setlist[0], 1, 'seed');
    expect(resolveLiveSong(ctx, session, ctx.setlist[0], 1, 'seed')).toEqual(result);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    const next = applySongResultToSession(session, result, ctx.setlist[0]);
    expect(next.crowdEnergy).toBeGreaterThanOrEqual(0);
    expect(next.fanSatisfaction).toBeGreaterThanOrEqual(0);
    expect(next.bandStamina).toBeLessThan(session.bandStamina);
  });

  it('rewards stronger preparation and penalizes low familiarity', () => {
    const session = buildInitialLiveSession(ctx, new Date('2026-07-11T12:00:00Z'));
    const strong = resolveLiveSong(ctx, session, ctx.setlist[0], 1, 'prep');
    const weak = resolveLiveSong({ ...ctx, readiness: calculateGigReadiness({ setlistSongs: [{ id: 'song-1', durationSeconds: 180, rehearsalLevel: 10 }], assignedPerformers: 1, requiredPerformers: 1 }) }, session, { ...ctx.setlist[0], song: { ...ctx.setlist[0].song, familiarity: 10 } }, 1, 'prep');
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('supports tactical decisions, automatic fallbacks, encore checks and immutable completed segments', () => {
    const session = buildInitialLiveSession(ctx, new Date('2026-07-11T12:00:00Z'));
    const incident = maybeGenerateLiveIncident({ ...ctx, equipment: [{ equipmentRole: 'amplifier', quality: 20, condition: 20, isSpare: false }] }, { ...session, bandStamina: 20 }, { ...buildLiveTimeline(ctx)[1], segmentIndex: 1 }, 'likely-incident') ?? { incidentType: 'equipment_fault', category: 'equipment' as const, severity: 'moderate' as const, title: 'Equipment fault', decisionType: 'equipment_response', generationSnapshot: {}, resultSnapshot: {} };
    const decision = buildTacticalDecision(incident);
    expect(decision?.recommendedFallback).toBe('use_spare');
    expect(evaluateEncore({ ...session, crowdEnergy: 80, fanSatisfaction: 78, bandStamina: 60 }, 1, 2000).allowed).toBe(true);
    expect(evaluateEncore({ ...session, crowdEnergy: 20 }, 1, 2000).outcome).toBe('no_encore_requested');
    expect(canApplyLiveSetlistChange([{ ...buildLiveTimeline(ctx)[1], status: 'resolved' }], 1, 'skip').allowed).toBe(false);
  });

  it('finalizes from persisted song results with idempotency keys', () => {
    const session = buildInitialLiveSession(ctx, new Date('2026-07-11T12:00:00Z'));
    const song = resolveLiveSong(ctx, session, ctx.setlist[0], 1, 'final');
    const final = finalizeLiveGig(applySongResultToSession(session, song, ctx.setlist[0]), [song], []);
    expect(final.finalQuality).toBeGreaterThan(0);
    expect(final.rewardsIdempotencyKey).toContain('gig-1:live-gig');
    expect(final.financeIdempotencyKey).toContain('finance');
  });
});
