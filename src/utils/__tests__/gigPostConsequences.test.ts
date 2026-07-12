import { describe, expect, it } from 'vitest';
import { buildGigConsequenceSummary, calculateEquipmentWear, calculateFanDelta, updateLiveReputation, type GigConsequenceInput } from '../gigPostConsequences';

const base = (overrides: Partial<GigConsequenceInput> = {}): GigConsequenceInput => ({ gigId:'gig-1', bandId:'band-1', venueId:'venue-1', promoterId:'promoter-1', cityId:'city-1', genre:'rock', venueCapacity:500, actualAttendance:420, expectedAttendance:350, overallRating:21, fanSatisfaction:88, crowdEnergyPeak:92, soundQuality:80, productionQuality:76, setlistCompletionRate:100, incidentSeverity:0, ticketPrice:20, previousFans:1000, previousFollowers:300, previousReputation:{ overallScore:55, performanceScore:55, professionalismScore:55, crowdConnectionScore:55, reliabilityScore:55, productionScore:55, experienceCount:2 }, ...overrides });

describe('post-gig consequences', () => {
  it('improves live reputation for a strong completed gig and persists explainable consequences', () => {
    const summary = buildGigConsequenceSummary(base());
    expect(summary.liveReputation.overallScore).toBeGreaterThan(55);
    expect(summary.consequences.find(c => c.key === 'live_reputation.overall')?.sourceFactors).toContain('attendance_vs_expectation');
    expect(summary.consequences.some(c => c.category === 'contextual_reputation')).toBe(true);
  });

  it('caps poor-gig reputation loss for established bands', () => {
    const result = updateLiveReputation(base({ overallRating: 6, fanSatisfaction: 25, actualAttendance: 80, expectedAttendance: 500, incidentSeverity: 4, previousReputation: { overallScore: 82, performanceScore: 82, professionalismScore: 82, crowdConnectionScore: 82, reliabilityScore: 82, productionScore: 82, experienceCount: 40 } }));
    expect(result.deltas.overallScore).toBeGreaterThanOrEqual(-4.5);
    expect(result.updated.overallScore).toBeGreaterThan(75);
  });

  it('moves new bands faster than established bands', () => {
    const strong = base({ previousReputation: { overallScore: 50, performanceScore: 50, professionalismScore: 50, crowdConnectionScore: 50, reliabilityScore: 50, productionScore: 50, experienceCount: 0 } });
    const established = base({ previousReputation: { ...strong.previousReputation!, experienceCount: 25 } });
    expect(updateLiveReputation(strong).deltas.overallScore).toBeGreaterThan(updateLiveReputation(established).deltas.overallScore);
  });

  it('caps fan growth and never allows follower loss below zero', () => {
    const high = calculateFanDelta(base({ actualAttendance: 1000, venueCapacity: 1000 }), 90);
    expect(high.fanDelta).toBeLessThanOrEqual(high.cap);
    const poor = calculateFanDelta(base({ actualAttendance: 100, previousFollowers: 3 }), 20);
    expect(poor.followerDelta).toBeGreaterThanOrEqual(-3);
  });

  it('applies equipment wear once with bounds, incident damage, spare mitigation and technician support', () => {
    const used = calculateEquipmentWear(60, 40, 1.2, 3, 0, false);
    const spare = calculateEquipmentWear(60, 40, 1.2, 3, 80, true);
    expect(used.newCondition).toBeGreaterThanOrEqual(0);
    expect(used.delta).toBeLessThan(spare.delta);
    expect(used.repairRecommended).toBe(true);
  });

  it('bases performer and crew progression on actual participation', () => {
    const summary = buildGigConsequenceSummary(base({ performers: [{ id:'p-1', performedSongs: 8, totalSongs: 8, standoutCount: 1 }, { id:'p-2', performedSongs: 0, totalSongs: 8, mistakeCount: 1 }], crew: [{ id:'c-1', role:'sound', attended:true, contributionScore:85, interventionCount:1 }, { id:'c-2', role:'lights', attended:false }] }));
    const full = summary.consequences.find(c => c.targetId === 'p-1' && c.key === 'performer.progression')?.value ?? 0;
    const absent = summary.consequences.find(c => c.targetId === 'p-2' && c.key === 'performer.progression')?.value ?? 0;
    expect(full).toBeGreaterThan(absent);
    expect(summary.consequences.some(c => c.targetId === 'c-1' && c.category === 'crew')).toBe(true);
    expect(summary.consequences.some(c => c.targetId === 'c-2')).toBe(false);
  });
});
