import { describe, expect, it } from "vitest";
import { SKILL_QUEST_DEFINITIONS, validateSkillQuestDefinitions } from "../skillQuests";

describe("Phase 2 skill quest catalogue", () => {
  it("has unique, valid targets and no unverified reward promises", () => {
    expect(validateSkillQuestDefinitions(SKILL_QUEST_DEFINITIONS)).toBe(true);
    expect(SKILL_QUEST_DEFINITIONS.map((q) => q.eventType)).toEqual([
      "gig_completed", "songwriting_completed", "recording_completed", "instrument_crafted",
    ]);
    expect(SKILL_QUEST_DEFINITIONS.every((q) => q.rewardStatus === "not_configured")).toBe(true);
  });

  it("rejects duplicate quest IDs and invalid targets", () => {
    const first = SKILL_QUEST_DEFINITIONS[0];
    expect(validateSkillQuestDefinitions([first, { ...first }])).toBe(false);
    expect(validateSkillQuestDefinitions([{ ...first, target: 0 }])).toBe(false);
  });
});
