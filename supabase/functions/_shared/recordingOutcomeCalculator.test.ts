import { describe, expect, it } from "vitest";
import { calculateRecordingOutcome } from "./recordingOutcomeCalculator";

const performer = (overrides = {}) => ({
  profileId: "p1",
  role: "lead_vocals",
  skills: { vocals: 70, performance: 55, music_theory: 40 },
  attributes: { vocal_talent: 70, musicality: 60, mental_focus: 60, rhythm_sense: 50, musical_ability: 50 },
  songFamiliarity: 60,
  rehearsalReadiness: 60,
  health: 85,
  energy: 85,
  focus: 75,
  equipmentQuality: 55,
  equipmentSuitability: 60,
  ...overrides,
});

const base = {
  sessionId: "s1",
  songId: "song1",
  sourceSongQuality: 60,
  requiredRoles: ["lead_vocals"],
  performers: [performer()],
  studio: { quality: 60, equipment: 60 },
  producer: { kind: "npc" as const, rating: 55 },
  engineer: { kind: "studio_default" as const, rating: 55 },
  sessionMode: "professional",
  effortHours: 24,
  bandCohesion: 60,
  chemistry: 60,
  seed: "stable-seed",
};

describe("recording outcome calculator", () => {
  it("keeps source songwriting separate from final master quality", () => {
    const strongSongWeakTake = calculateRecordingOutcome({ ...base, sourceSongQuality: 90, performers: [performer({ skills: { vocals: 15 }, attributes: { vocal_talent: 45 } })] });
    const modestSongGreatTake = calculateRecordingOutcome({ ...base, sourceSongQuality: 45, performers: [performer({ skills: { vocals: 95, performance: 90 }, attributes: { vocal_talent: 95, mental_focus: 90 } })], studio: { quality: 90, equipment: 90 } });
    expect(strongSongWeakTake.finalMasterQuality).toBeLessThan(90);
    expect(modestSongGreatTake.finalMasterQuality).toBeGreaterThan(45);
    expect(modestSongGreatTake.finalMasterQuality).toBeLessThan(90);
    expect(modestSongGreatTake.breakdown.weights).toMatchObject({ sourceSong: 0.35, performerExecution: 0.30 });
  });

  it("uses role-specific skills and does not let attributes replace missing skill", () => {
    const skilled = calculateRecordingOutcome({ ...base, performers: [performer({ skills: { vocals: 85, guitar: 5 }, attributes: { vocal_talent: 70, mental_focus: 70 } })] });
    const wrongSkill = calculateRecordingOutcome({ ...base, performers: [performer({ skills: { guitar: 95, vocals: 5 }, attributes: { vocal_talent: 95, mental_focus: 95 } })] });
    expect(skilled.breakdown.performerExecution as number).toBeGreaterThan(wrongSkill.breakdown.performerExecution as number);
    expect(wrongSkill.finalMasterQuality).toBeLessThan(skilled.finalMasterQuality);
  });

  it("penalizes missing roles and duplicate exclusive assignments", () => {
    const missing = calculateRecordingOutcome({ ...base, requiredRoles: ["lead_vocals", "drums"], performers: [performer()] });
    const duplicate = calculateRecordingOutcome({ ...base, requiredRoles: ["lead_vocals"], performers: [performer({ profileId: "p1" }), performer({ profileId: "p2" })] });
    expect(missing.warnings.join(" ")).toContain("Missing required role: drums");
    expect(duplicate.warnings.join(" ")).toContain("Duplicate exclusive assignment: lead_vocals");
  });

  it("bounds variance and is deterministic for repeated completion", () => {
    const first = calculateRecordingOutcome(base);
    const second = calculateRecordingOutcome(base);
    expect(first.appliedVariance).toBe(second.appliedVariance);
    expect(Math.abs(first.appliedVariance)).toBeLessThanOrEqual(0.04);
    expect(calculateRecordingOutcome({ ...base, existingOutcome: first })).toBe(first);
  });

  it("models duration and mode trade-offs without making one mode universally best", () => {
    const oneDay = calculateRecordingOutcome({ ...base, effortHours: 24 });
    const threeDays = calculateRecordingOutcome({ ...base, effortHours: 72 });
    const party = calculateRecordingOutcome({ ...base, sessionMode: "party", seed: "party-seed" });
    const pro = calculateRecordingOutcome({ ...base, sessionMode: "professional", seed: "party-seed" });
    expect(threeDays.breakdown.durationBenefit as number).toBeGreaterThan(oneDay.breakdown.durationBenefit as number);
    expect(party.appliedVariance).not.toBe(pro.appliedVariance);
  });
});
