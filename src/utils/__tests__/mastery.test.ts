import { describe, expect, it } from "vitest";
import { calculateMasteryRewardXp, canSelectSpecialisation, getApplicableMasteryEffects, getMasteryProgress, getMasteryRankFromXp, getSpecialisationsForSkill, getTotalDirectMasteryAdvantage, respecialiseMasteryXp, SKILL_SPECIALISATIONS } from "../mastery";

describe("mastery progression", () => {
  it("exposes visible specialisations and hides hidden paths by default", () => {
    expect(getSpecialisationsForSkill("production").some((s) => s.isHidden)).toBe(false);
    expect(getSpecialisationsForSkill("production", true).some((s) => s.isHidden)).toBe(true);
  });

  it("calculates bounded ranks from named curves", () => {
    const spec = SKILL_SPECIALISATIONS.find((s) => s.id === "guitar_live")!;
    expect(getMasteryRankFromXp(spec, 0)).toBe(0);
    expect(getMasteryRankFromXp(spec, 8500)).toBe(2);
    expect(getMasteryProgress(spec, 8500)).toMatchObject({ rank: 2, rankName: "Expert" });
  });

  it("applies diminishing returns to repeated trivial activity", () => {
    const first = calculateMasteryRewardXp({ profileId: "p", skillId: "guitar", specialisationId: "guitar_live", source: "gig", sourceRecordId: "g1", baseXp: 100, difficulty: 1, quality: 1, repetitionCount: 0, idempotencyKey: "a" });
    const repeated = calculateMasteryRewardXp({ profileId: "p", skillId: "guitar", specialisationId: "guitar_live", source: "gig", sourceRecordId: "g2", baseXp: 100, difficulty: 1, quality: 1, repetitionCount: 3, idempotencyKey: "b" });
    const trivial = calculateMasteryRewardXp({ profileId: "p", skillId: "guitar", specialisationId: "guitar_live", source: "gig", sourceRecordId: "g3", baseXp: 100, difficulty: 0.2, quality: 1, idempotencyKey: "c" });
    expect(repeated).toBeLessThan(first);
    expect(trivial).toBe(0);
  });

  it("keeps effects system-specific and below total cap", () => {
    const liveEffects = getApplicableMasteryEffects([{ profileId: "p", skillId: "guitar", specialisationId: "guitar_live", masteryXp: 9000, masteryRank: 2 }], "live_gig");
    const recordingEffects = getApplicableMasteryEffects([{ profileId: "p", skillId: "guitar", specialisationId: "guitar_live", masteryXp: 9000, masteryRank: 2 }], "recording");
    expect(liveEffects.length).toBeGreaterThan(0);
    expect(recordingEffects).toHaveLength(0);
    expect(getTotalDirectMasteryAdvantage(liveEffects)).toBeLessThanOrEqual(0.1);
  });

  it("enforces one selected path per skill and safe respecialisation retention", () => {
    const studio = SKILL_SPECIALISATIONS.find((s) => s.id === "guitar_studio")!;
    expect(canSelectSpecialisation([{ profileId: "p", skillId: "guitar", specialisationId: "guitar_live", masteryXp: 1000, masteryRank: 0 }], studio)).toBe(false);
    expect(respecialiseMasteryXp(10000)).toBe(7500);
  });
});
