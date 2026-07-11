import { describe, expect, it } from 'vitest';
import { calculatePreshowRisk, calculatePreshowSkillCheck, generatePreshowIncidents, getPreshowSessionStatus, getPreshowWindow, applyPreshowConsequencesToReadiness, summarizePreshowPerformanceModifiers } from '../gigPreshow';
import type { PreshowContext } from '../gigPreshow';

const readiness = { score: 78, rating: 'excellent' as const, factors: [], blockingIssues: [], warnings: [] };
const base: PreshowContext = { gigId: 'gig-1', bandId: 'band-1', scheduledAt: new Date(Date.now() + 12 * 3600_000).toISOString(), gigSize: 'medium', status: 'scheduled', readiness, crew: [{ role: 'sound_engineer', workerType: 'npc_staff', status: 'accepted', baseAbility: 70, attendance: 'confirmed' }, { role: 'stage_manager', workerType: 'npc_staff', status: 'accepted', baseAbility: 70, attendance: 'confirmed' }], equipment: [{ equipmentRole: 'amplifier', quality: 75, condition: 30, isPrimary: true }, { equipmentRole: 'amplifier', quality: 60, condition: 80, isSpare: true }], soundcheckType: 'standard_soundcheck', soundcheckValid: true, bandFunds: 1000, capacity: 400, ticketsSold: 250 };

describe('gig pre-show utilities', () => {
  it('opens and locks sessions from configurable windows', () => {
    const scheduledAt = new Date('2026-07-12T20:00:00Z');
    const ctx = { ...base, scheduledAt, gigSize: 'headline' as const };
    expect(getPreshowWindow(ctx).opensAt).toBe('2026-07-10T20:00:00.000Z');
    expect(getPreshowSessionStatus(ctx, new Date('2026-07-10T19:00:00Z'))).toBe('not_started');
    expect(getPreshowSessionStatus(ctx, new Date('2026-07-11T20:00:00Z'))).toBe('open');
    expect(getPreshowSessionStatus(ctx, new Date('2026-07-12T19:35:00Z'))).toBe('open');
    expect(getPreshowSessionStatus(ctx, new Date('2026-07-12T19:31:00Z'))).toBe('open');
    expect(getPreshowSessionStatus(ctx, new Date('2026-07-12T19:30:00Z'))).toBe('locked');
  });

  it('generates incidents deterministically and never rerolls on refresh', () => {
    const now = new Date(Date.now());
    const first = generatePreshowIncidents(base, now);
    const second = generatePreshowIncidents(base, now);
    expect(second).toEqual(first);
    expect(first.length).toBeLessThanOrEqual(2);
    expect(first.every(i => i.options.some(o => o.defaultFallback))).toBe(true);
  });

  it('uses eligibility data for concrete equipment incidents', () => {
    const incidents = generatePreshowIncidents({ ...base, gigSize: 'headline', readiness: { ...readiness, score: 20 } }, new Date());
    const amp = incidents.find(i => i.incidentType === 'amplifier_fault');
    if (amp) {
      expect(amp.eligibilitySnapshot.explanation).toContain('amplifier');
      expect(amp.options.find(o => o.key === 'use_spare')?.unavailableReason).toBeUndefined();
    }
  });

  it('reduces risk and incident count for well-prepared gigs', () => {
    const weak = { ...base, readiness: { ...readiness, score: 25 }, crew: [], equipment: [{ equipmentRole: 'amplifier' as const, quality: 35, condition: 20, isPrimary: true }], soundcheckType: 'none' as const };
    const strong = { ...base, readiness: { ...readiness, score: 96 } };
    expect(calculatePreshowRisk(strong)).toBeLessThan(calculatePreshowRisk(weak));
    expect(generatePreshowIncidents(strong, new Date()).length).toBeLessThanOrEqual(generatePreshowIncidents(weak, new Date()).length);
  });

  it('clamps skill checks and rewards skill/preparation', () => {
    const low = calculatePreshowSkillCheck({ baseChance: 50, relevantSkill: 20, equipmentQuality: 20, preparationScore: 20, difficulty: 80 });
    const high = calculatePreshowSkillCheck({ baseChance: 50, relevantSkill: 90, equipmentQuality: 90, preparationScore: 95, minutesUntilDeadline: 180 });
    expect(low.finalChance).toBe(15);
    expect(high.finalChance).toBeGreaterThan(low.finalChance);
    expect(high.finalChance).toBeLessThanOrEqual(92);
  });

  it('caps consequence application for readiness and performance', () => {
    const updated = applyPreshowConsequencesToReadiness(readiness, [{ readinessModifier: -99 }]);
    expect(updated.score).toBe(60);
    const mods = summarizePreshowPerformanceModifiers([{ performanceModifier: 1, soundQualityModifier: -1, flags: ['x'] }]);
    expect(mods.performanceModifier).toBe(0.12);
    expect(mods.soundQualityModifier).toBe(-0.1);
    expect(mods.flags).toEqual(['x']);
  });
});
