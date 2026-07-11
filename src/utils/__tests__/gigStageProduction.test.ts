import { describe, expect, it } from 'vitest';
import { calculateProductionCost, calculateProductionOutcomeModifiers, calculateProductionQuality, validateProductionPlan, validateSoundcheckPlan } from '../gigStageProduction';

describe('gig stage production and soundcheck preparation', () => {
  const smallVenue = { capacity: 120, prestigeLevel: 1, venueType: 'club', setupAccessMinutes: 80, screenSupport: false, allowsPyro: false, allowsSmokeHaze: false };
  const theatre = { capacity: 900, prestigeLevel: 4, venueType: 'theatre', setupAccessMinutes: 240, screenSupport: true, allowsPyro: true, allowsSmokeHaze: true };

  it('calculates server-authoritative production costs and setup time', () => {
    const result = calculateProductionCost({ lightingPackage: 'enhanced', visualPackage: 'branded_projection', effectsPackage: 'haze', setupLevel: 'expanded', additionalStageCrew: 2 }, theatre);
    expect(result.total).toBeGreaterThan(0);
    expect(result.setupMinutes).toBe(210);
    expect(result.crewRequired).toBeGreaterThanOrEqual(2);
  });

  it('rejects unsupported venue options', () => {
    const validation = validateProductionPlan({ lightingPackage: 'arena_spectacle', visualPackage: 'led_visuals', effectsPackage: 'full_pyro', setupLevel: 'festival_scale' }, smallVenue);
    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toContain('pyrotechnics');
  });

  it('scores matched production better than oversized production', () => {
    const matched = calculateProductionQuality({ plan: { lightingPackage: 'enhanced', visualPackage: 'branded_projection', effectsPackage: 'haze', setupLevel: 'expanded' }, venue: theatre, crew: [{ role: 'lighting_engineer', workerType: 'npc_staff', baseAbility: 80, status: 'accepted' }, { role: 'stage_manager', workerType: 'npc_staff', baseAbility: 78, status: 'accepted' }], equipment: [{ equipmentRole: 'mixing', quality: 80, condition: 85, isPrimary: true }] });
    const oversized = calculateProductionQuality({ plan: { lightingPackage: 'arena_spectacle', visualPackage: 'synchronised_show', effectsPackage: 'full_pyro', setupLevel: 'festival_scale' }, venue: smallVenue, crew: [], equipment: [] });
    expect(matched.score).toBeGreaterThan(oversized.score);
    expect(oversized.factors.find((f) => f.key === 'venueCompatibility')?.status).toBe('critical');
  });

  it('validates soundcheck scheduling and fatigue trade-offs', () => {
    const gigStart = '2026-08-01T20:00:00Z';
    const valid = validateSoundcheckPlan({ soundcheckType: 'standard_soundcheck', scheduledStart: '2026-08-01T18:30:00Z' }, { gigStart, venueAccessStart: '2026-08-01T16:00:00Z', setupMinutes: 90 });
    const invalid = validateSoundcheckPlan({ soundcheckType: 'full_production_soundcheck', scheduledStart: '2026-08-01T19:50:00Z' }, { gigStart, venueAccessStart: '2026-08-01T16:00:00Z', setupMinutes: 90 });
    expect(valid.valid).toBe(true);
    expect(valid.fatigueImpact).toBeGreaterThan(0);
    expect(invalid.valid).toBe(false);
  });

  it('creates capped outcome modifiers and deterministic incidents', () => {
    const quality = calculateProductionQuality({ plan: { lightingPackage: 'professional', visualPackage: 'led_visuals', effectsPackage: 'limited_pyro', setupLevel: 'headline' }, venue: theatre, crew: [{ role: 'stage_manager', workerType: 'npc_staff', baseAbility: 40, status: 'accepted' }], equipment: [] });
    const mods = calculateProductionOutcomeModifiers({ quality, soundcheckType: 'line_check', seed: 1 });
    expect(mods.audienceExcitementModifier).toBeLessThanOrEqual(0.1);
    expect(mods.incidentRisk).toBeGreaterThanOrEqual(2);
  });
});
