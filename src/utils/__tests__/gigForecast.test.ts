import { describe, expect, it } from 'vitest';
import { calculateAttendanceForecast, generateGigForecast, type GigForecastInput } from '../gigForecast';
import type { ReadinessResult } from '../gigReadiness';

const readiness = (score = 75, blockingIssues: string[] = []): ReadinessResult => ({ score, rating: score >= 70 ? 'excellent' : 'good', factors: [], blockingIssues, warnings: [] });
const base = (overrides: Partial<GigForecastInput> = {}): GigForecastInput => ({ gigId: 'gig-1', status: 'scheduled', capacity: 1000, ticketPrice: 20, ticketsSold: 120, readiness: readiness(), crew: [{ role: 'sound_engineer', workerType: 'npc_staff', attendance: 'confirmed', fee: 100 }, { role: 'stage_manager', workerType: 'npc_staff', attendance: 'confirmed', fee: 100 }], equipment: [{ equipmentRole: 'pa_speaker', quality: 80, condition: 80, isPrimary: true, rentalCost: 50 }, { equipmentRole: 'mixing', quality: 80, condition: 80, isPrimary: true, rentalCost: 50 }, { equipmentRole: 'spare_instrument', quality: 70, condition: 70, isSpare: true }], productionValid: true, soundcheckType: 'standard_soundcheck', soundcheckValid: true, setlistSongCount: 10, setlistDurationSeconds: 5400, slotDurationSeconds: 6000, hasEncore: true, localPopularity: 60, globalFame: 50, genreAffinity: 55, promotionScore: 20, productionCost: 400, soundcheckCost: 150, venueHireCost: 300, ...overrides });

describe('gig forecast foundations', () => {
  it('caps attendance at capacity and uses sold tickets as a floor', () => {
    const f = calculateAttendanceForecast(base({ capacity: 500, ticketsSold: 480, localPopularity: 100, promotionScore: 100 }));
    expect(f.high).toBeLessThanOrEqual(500);
    expect(f.low).toBeGreaterThanOrEqual(480);
    expect(f.low).toBeLessThanOrEqual(f.likely);
    expect(f.likely).toBeLessThanOrEqual(f.high);
  });

  it('raises demand with local popularity and lowers it with expensive tickets', () => {
    const weak = calculateAttendanceForecast(base({ localPopularity: 10, ticketsSold: 0 }));
    const strong = calculateAttendanceForecast(base({ localPopularity: 90, ticketsSold: 0 }));
    const pricey = calculateAttendanceForecast(base({ localPopularity: 90, ticketPrice: 90, ticketsSold: 0 }));
    expect(strong.likely).toBeGreaterThan(weak.likely);
    expect(pricey.likely).toBeLessThan(strong.likely);
  });

  it('makes larger venues harder to fill and repeated local gigs reduce demand', () => {
    const small = calculateAttendanceForecast(base({ capacity: 300, ticketsSold: 0 }));
    const large = calculateAttendanceForecast(base({ capacity: 3000, ticketsSold: 0 }));
    expect(large.sellThroughPercent).toBeLessThan(small.sellThroughPercent);
    const repeat = calculateAttendanceForecast(base({ capacity: 1000, ticketsSold: 0, repeatedLocalGigs: 4 }));
    const fresh = calculateAttendanceForecast(base({ capacity: 1000, ticketsSold: 0, repeatedLocalGigs: 0 }));
    expect(repeat.likely).toBeLessThan(fresh.likely);
  });

  it('calculates revenue, committed costs, profit range and break-even attendance', () => {
    const f = generateGigForecast(base({ ticketPrice: 25, ticketsSold: 0, venueHireCost: 300, productionCost: 400, soundcheckCost: 150 }));
    expect(f.expectedRevenue.tickets.likely).toBe(f.expectedAttendance.likely * 25);
    expect(f.expectedCosts.total).toBe(300 + 200 + 100 + 400 + 150);
    expect(f.expectedProfit.low).toBeLessThanOrEqual(f.expectedProfit.likely);
    expect(f.breakEvenAttendance).toBeGreaterThan(0);
  });

  it('supports fixed-fee gigs and merchandise attendance estimates', () => {
    const f = generateGigForecast(base({ ticketPrice: 0, fixedFee: 2000, merchandiseSpendPerAttendee: 6, merchandiseMargin: 0.5 }));
    expect(f.expectedRevenue.other.likely).toBe(2000);
    expect(f.expectedRevenue.merchandise.likely).toBe(f.expectedAttendance.likely * 3);
  });

  it('improves performance with readiness and reduces confidence/ranges for missing prep', () => {
    const good = generateGigForecast(base({ readiness: readiness(92) }));
    const poor = generateGigForecast(base({ readiness: readiness(35), equipment: [], crew: [], soundcheckType: 'none' }));
    expect(good.expectedPerformanceQuality.likely).toBeGreaterThan(poor.expectedPerformanceQuality.likely);
    expect(poor.confidenceScore).toBeLessThan(good.confidenceScore);
    expect(poor.expectedPerformanceQuality.high - poor.expectedPerformanceQuality.low).toBeGreaterThan(good.expectedPerformanceQuality.high - good.expectedPerformanceQuality.low);
  });

  it('detects poor equipment, skilled crew, incompatible production, soundcheck and fatigue effects', () => {
    const bad = generateGigForecast(base({ equipment: [{ equipmentRole: 'pa_speaker', quality: 20, condition: 10, isPrimary: true }], productionValid: false, fatigueScore: 20 }));
    const good = generateGigForecast(base({ crew: [{ role: 'sound_engineer', workerType: 'player', relevantSkill: 100, attendance: 'confirmed' }, { role: 'stage_manager', workerType: 'player', relevantSkill: 100, attendance: 'confirmed' }], soundcheckType: 'full_production_soundcheck' }));
    expect(bad.risks.some(r => r.key === 'poor_equipment')).toBe(true);
    expect(bad.risks.some(r => r.key === 'production_incompatible')).toBe(true);
    expect(good.expectedPerformanceQuality.likely).toBeGreaterThan(bad.expectedPerformanceQuality.likely);
  });

  it('builds checklist and readiness status for missing, blocked and fully prepared gigs', () => {
    const missing = generateGigForecast(base({ readiness: readiness(20, ['A saved setlist with at least one song is required.']), setlistSongCount: 0, equipment: [] }));
    expect(missing.preparationStatus).toBe('not_ready');
    expect(missing.checklist.find(i => i.key === 'setlist_exists')?.blocking).toBe(true);
    const completed = generateGigForecast(base({ status: 'completed' }));
    expect(completed.preparationStatus).toBe('not_ready');
    const full = generateGigForecast(base({ readiness: readiness(95), ticketsSold: 900, localPopularity: 90, equipment: [{ equipmentRole: 'pa_speaker', quality: 90, condition: 90, isPrimary: true }, { equipmentRole: 'mixing', quality: 90, condition: 90, isPrimary: true }, { equipmentRole: 'spare_instrument', isSpare: true, quality: 80, condition: 80 }] }));
    expect(['ready', 'fully_prepared']).toContain(full.preparationStatus);
  });
});
