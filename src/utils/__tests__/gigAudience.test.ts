import { describe, expect, it } from 'vitest';
import { aggregateAudienceResponse, calculateAudienceParticipationScore, calculateAudienceReward, checkAudienceReactionRateLimit, evaluateAudienceEligibility, validateAudienceReactionTiming } from '../gigAudience';

describe('gigAudience eligibility and check-in rules', () => {
  it('allows valid same-city ticket holders to attend and view', () => {
    const result = evaluateAudienceEligibility({ hasTicket: true, playerCityId: 'city-a', venueCityId: 'city-a', gigStatus: 'in_progress' });
    expect(result.canAttend).toBe(true); expect(result.canView).toBe(true); expect(result.attendanceType).toBe('ticket_holder');
  });
  it('rejects wrong-city physical attendance', () => {
    const result = evaluateAudienceEligibility({ hasTicket: true, playerCityId: 'city-b', venueCityId: 'city-a', gigStatus: 'in_progress' });
    expect(result.canAttend).toBe(false); expect(result.reasons).toContain('Player is not in the gig city.');
  });
  it('allows remote viewing without capacity consumption when public viewing is enabled', () => {
    const result = evaluateAudienceEligibility({ publicViewingEnabled: true, gigStatus: 'in_progress' });
    expect(result.canAttend).toBe(false); expect(result.canView).toBe(true); expect(result.attendanceType).toBe('remote_viewer');
  });
  it('rejects cancelled gigs', () => {
    const result = evaluateAudienceEligibility({ hasTicket: true, gigStatus: 'cancelled' });
    expect(result.canAttend).toBe(false); expect(result.canView).toBe(false);
  });
});

describe('gigAudience reactions', () => {
  const session = { status: 'live' as const };
  it('accepts a singalong during an active song', () => {
    expect(validateAudienceReactionTiming('sing_along', { segmentType: 'song', status: 'active' }, session).allowed).toBe(true);
  });
  it('rejects future or invalid timing', () => {
    expect(validateAudienceReactionTiming('encore_request', { segmentType: 'song', status: 'pending' }, session).allowed).toBe(false);
    expect(validateAudienceReactionTiming('encore_request', { segmentType: 'song', status: 'active' }, session).allowed).toBe(false);
  });
  it('rate limits duplicate and rapid reactions', () => {
    expect(checkAudienceReactionRateLimit({ duplicateIdempotencyKey: true }).allowed).toBe(false);
    expect(checkAudienceReactionRateLimit({ lastReactionAt: '2026-07-12T00:00:00Z', now: '2026-07-12T00:00:02Z' }).retryAfterSeconds).toBe(2);
  });
  it('enforces song, gig and encore caps', () => {
    expect(checkAudienceReactionRateLimit({ songReactionCount: 6 }).reason).toMatch(/Song/);
    expect(checkAudienceReactionRateLimit({ gigReactionCount: 40 }).reason).toMatch(/Gig/);
    expect(checkAudienceReactionRateLimit({ encoreRequestCount: 1 }).reason).toMatch(/Encore/);
  });
  it('aggregates by unique attendees so one spammer cannot overpower the crowd', () => {
    const oneSpammer = Array.from({ length: 20 }, (_, i) => ({ playerId: 'p1', attendanceId: 'a1', reactionType: i % 2 ? 'cheer' as const : 'clap' as const, createdAt: new Date() }));
    const varied = ['p1', 'p2', 'p3', 'p4'].map((playerId, i) => ({ playerId, attendanceId: `a${i}`, reactionType: 'cheer' as const, createdAt: new Date() }));
    expect(aggregateAudienceResponse(varied, 8).audienceModifier).toBeGreaterThan(aggregateAudienceResponse(oneSpammer, 8).audienceModifier);
    expect(aggregateAudienceResponse(oneSpammer, 8).audienceModifier).toBeLessThanOrEqual(4);
  });
});

describe('gigAudience rewards and score', () => {
  it('calculates bounded participation score with invalid attempt penalties', () => {
    const score = calculateAudienceParticipationScore({ watchedSongs: 8, totalSongs: 10, validReactionCount: 6, reactionVariety: 4, stayedToEnd: true, encoreParticipated: true, invalidAttempts: 2, removed: false, watchDurationSeconds: 1800 });
    expect(score).toBeGreaterThan(50); expect(score).toBeLessThanOrEqual(100);
  });
  it('does not reward remote viewers or removed attendees', () => {
    expect(calculateAudienceReward(90, 'completed', 'remote_viewer').fanXp).toBe(0);
    expect(calculateAudienceReward(90, 'removed', 'ticket_holder').fanXp).toBe(0);
  });
  it('reduces rewards for leaving early', () => {
    expect(calculateAudienceReward(80, 'left_early', 'ticket_holder').fanXp).toBeLessThan(calculateAudienceReward(80, 'completed', 'ticket_holder').fanXp);
  });
});
