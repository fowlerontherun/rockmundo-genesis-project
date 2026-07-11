import { describe, expect, it } from 'vitest';
import { calculateCrewEffectiveness, calculateCrewEquipmentReadiness, calculateEquipmentReliability, calculateGigPreparationOutcomeModifiers, deriveEquipmentRequirements } from '../gigCrewEquipment';

describe('gig crew and equipment preparation', () => {
  const songs = [{ id: 'song-1', durationSeconds: 1800, rehearsalLevel: 80 }];
  it('bases real-player effectiveness on skills and attendance rather than player status alone', () => {
    const low = calculateCrewEffectiveness({ role: 'sound_engineer', workerType: 'player', relevantSkill: 5, attendance: 'confirmed', fatigue: 80 });
    const npc = calculateCrewEffectiveness({ role: 'sound_engineer', workerType: 'npc_staff', baseAbility: 65, workerQuality: 70, attendance: 'confirmed' });
    const high = calculateCrewEffectiveness({ role: 'sound_engineer', workerType: 'player', relevantSkill: 95, experience: 6, workerQuality: 80, engagement: 90, attendance: 'confirmed' });
    expect(low).toBeLessThan(npc);
    expect(high).toBeGreaterThan(npc);
  });

  it('detects role and song based equipment requirements', () => {
    const req = deriveEquipmentRequirements(['lead guitarist', 'vocalist'], ['drums']);
    expect(req.filter((r) => r.required).map((r) => r.role)).toEqual(expect.arrayContaining(['vocals_microphone', 'guitar', 'drum_kit', 'amplifier', 'pa_speaker', 'mixing']));
  });

  it('calculates reliability from condition quality technicians and spares', () => {
    const base = calculateEquipmentReliability([{ equipmentRole: 'guitar', quality: 45, condition: 38, isPrimary: true }]);
    const supported = calculateEquipmentReliability([{ equipmentRole: 'guitar', quality: 80, condition: 90, isPrimary: true }, { equipmentRole: 'guitar', quality: 70, condition: 80, isSpare: true }], [{ role: 'guitar_technician', workerType: 'npc_staff', status: 'accepted' }]);
    expect(supported.score).toBeGreaterThan(base.score);
    expect(supported.failureRisk).toBeLessThan(base.failureRisk);
  });

  it('keeps readiness bounded and marks missing equipment as blocking', () => {
    const readiness = calculateCrewEquipmentReadiness({ baseSongs: songs, roles: ['vocalist'], crew: [{ role: 'sound_engineer', workerType: 'npc_staff', status: 'accepted' }], equipment: [] });
    expect(readiness.score).toBeGreaterThanOrEqual(0);
    expect(readiness.score).toBeLessThanOrEqual(100);
    expect(readiness.blockingIssues).toContain('Required equipment is missing from the gig loadout.');
  });

  it('adds capped outcome modifiers and failure risk', () => {
    const result = calculateGigPreparationOutcomeModifiers({ crew: [{ role: 'sound_engineer', workerType: 'player', relevantSkill: 90, attendance: 'confirmed' }], equipment: [{ equipmentRole: 'mixing', quality: 90, condition: 90, isPrimary: true }] });
    expect(result.soundQualityModifier).toBeLessThanOrEqual(0.07);
    expect(result.failureRisk).toBeLessThan(40);
  });
});
