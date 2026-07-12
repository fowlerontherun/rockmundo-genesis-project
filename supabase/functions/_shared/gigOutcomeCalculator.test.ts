import { describe, expect, it } from "vitest";
import { calculateGigOutcome } from "./gigOutcomeCalculator";

const performer = (overrides = {}) => ({
  profileId: "p1", role: "lead_vocals", skills: { vocals: 70, guitar: 5, performance: 55, music_theory: 40 },
  attributes: { vocal_talent: 70, musicality: 60, mental_focus: 60, rhythm_sense: 50, musical_ability: 50, stage_presence: 45, crowd_engagement: 45, charisma: 45, physical_endurance: 60 },
  health: 85, energy: 85, stress: 15, fatigue: 10, equipmentQuality: 60, equipmentSuitability: 65, ...overrides,
});
const song = (id: string, overrides = {}) => ({ id, title: id, durationSeconds: 180, difficulty: 45, arrangementComplexity: 45, rehearsalReadiness: 60, familiarityByProfile: { p1: 60, p2: 60, p3: 60, p4: 60 }, crowdFit: 60, tempo: 120, ...overrides });
const base = {
  gigId: "g1", bandId: "b1", venueId: "v1", seed: "stable", requiredRoles: ["lead_vocals", "lead_guitar", "bass", "drums"],
  participantAssignments: [performer(), performer({ profileId: "p2", role: "lead_guitar", skills: { guitar: 70, performance: 50 } }), performer({ profileId: "p3", role: "bass", skills: { bass: 70, rhythm: 55 } }), performer({ profileId: "p4", role: "drums", skills: { drums: 70, rhythm: 60 } })],
  songs: [song("s1"), song("s2", { difficulty: 70, crowdFit: 75 })], slotDurationSeconds: 420, bandCohesion: 62, chemistry: 62, rehearsalReadiness: 60, crewReadiness: 55, stageSetupQuality: 55, venueQuality: 55, venueGenreFit: 60, audienceSize: 120, venueCapacity: 200, fame: 100, ticketPrice: 12, localPopularity: 40,
};

describe("gig outcome calculator", () => {
  it("uses assigned role skills and rejects unrelated skills or attribute replacement", () => {
    const skilled = calculateGigOutcome(base);
    const wrong = calculateGigOutcome({ ...base, participantAssignments: [performer({ skills: { guitar: 99, vocals: 5 }, attributes: { ...performer().attributes, vocal_talent: 100 } }), ...base.participantAssignments.slice(1)] });
    expect(skilled.memberExecutions[0].primarySkill).toBe("vocals");
    expect(skilled.memberExecutions[0].score).toBeGreaterThan(wrong.memberExecutions[0].score);
  });

  it("keeps stage attributes out of technical accuracy", () => {
    const lowStage = calculateGigOutcome(base);
    const highStage = calculateGigOutcome({ ...base, participantAssignments: base.participantAssignments.map((p) => ({ ...p, attributes: { ...p.attributes, stage_presence: 100, crowd_engagement: 100, charisma: 100 } })) });
    expect(highStage.stagePerformanceScore).toBeGreaterThan(lowStage.stagePerformanceScore);
    expect(Math.abs(highStage.technicalScore - lowStage.technicalScore)).toBeLessThanOrEqual(1);
  });

  it("validates missing, absent, incompatible, duplicate, and equipment warnings", () => {
    const result = calculateGigOutcome({ ...base, participantAssignments: [performer({ accepted: false }), performer({ profileId: "p2", role: "lead_vocals" }), performer({ profileId: "p3", role: "drums", compatibleRoles: ["bass"] , equipmentMissing: true })] });
    expect(result.warnings.join(" ")).toContain("Missing required role: lead_guitar");
    expect(result.warnings.join(" ")).toContain("Unaccepted or absent");
    expect(result.warnings.join(" ")).toContain("Duplicate exclusive assignment: lead_vocals");
    expect(result.warnings.join(" ")).toContain("Incompatible role assignment");
    expect(result.warnings.join(" ")).toContain("Equipment missing");
  });

  it("calculates distinct song results with familiarity, rehearsal, difficulty and progressive fatigue", () => {
    const result = calculateGigOutcome({ ...base, songs: [song("easy", { difficulty: 20, rehearsalReadiness: 90, familiarityByProfile: { p1: 95, p2: 95, p3: 95, p4: 95 } }), song("hard", { difficulty: 90, rehearsalReadiness: 10, familiarityByProfile: { p1: 5, p2: 5, p3: 5, p4: 5 }, durationSeconds: 480 })] });
    expect(result.songPerformances).toHaveLength(2);
    expect(result.songPerformances[0].technicalScore).toBeGreaterThan(result.songPerformances[1].technicalScore);
    expect(result.songPerformances[1].fatiguePenalty).toBeGreaterThan(result.songPerformances[0].fatiguePenalty);
  });

  it("separates technical, stage, audience, fan and reputation outcomes", () => {
    const result = calculateGigOutcome(base);
    expect(result.technicalScore).not.toBe(result.audienceResponseScore);
    expect(result.stagePerformanceScore).not.toBe(result.technicalScore);
    expect(result.fanGrowth.localFans).toBeLessThanOrEqual(Math.ceil((base.audienceSize as number) * .25));
    expect(Number.isFinite(result.reputationChange)).toBe(true);
  });

  it("is deterministic, bounded, idempotent and expectation-aware", () => {
    const first = calculateGigOutcome(base);
    const second = calculateGigOutcome(base);
    expect(first).toEqual(second);
    expect(Math.abs(first.appliedVariance)).toBeLessThanOrEqual(.05);
    expect(calculateGigOutcome({ ...base, existingOutcome: first })).toBe(first);
    const famous = calculateGigOutcome({ ...base, fame: 100000 });
    expect(famous.technicalScore).toBe(first.technicalScore);
    expect(famous.audienceResponseScore).toBeLessThanOrEqual(first.audienceResponseScore);
  });

  it("awards XP only to active participants and bounds momentum", () => {
    const result = calculateGigOutcome({ ...base, participantAssignments: [...base.participantAssignments, performer({ profileId: "absent", role: "keyboards", attended: false })], songs: Array.from({ length: 8 }, (_, i) => song(`s${i}`, { crowdFit: i % 2 ? 20 : 90, tempo: i % 2 ? 80 : 160 })) });
    expect(result.xpAwards.some((x) => x.profileId === "absent")).toBe(false);
    expect(Math.max(...result.songPerformances.map((s) => Math.abs(s.momentumAfter)))).toBeLessThanOrEqual(100);
  });
});
