import { describe, expect, it } from "vitest";
import {
  getLuthieryPerformanceBonusPercent,
  getPersonalGearFitLabel,
  getPersonalGearRoleBonusPercent,
  personalGearMatchesRole,
} from "../personalGear";

describe("personal gear role fit", () => {
  it("matches guitars to guitar roles", () => {
    expect(personalGearMatchesRole("instrument", "electric_guitar", "Lead Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "electric_guitar", "Drums")).toBe(false);
  });

  it("supports role aliases used by band membership", () => {
    expect(personalGearMatchesRole("recording", "microphone", "Lead Vocals / Frontperson")).toBe(true);
  });

  it("mirrors rarity plus performance bonus for a matching item", () => {
    expect(
      getPersonalGearRoleBonusPercent(
        {
          category: "instrument",
          subcategory: "electric_guitar",
          rarity: "rare",
          stat_boosts: { performance: 7 },
        },
        "Lead Guitar",
      ),
    ).toBe(25);
  });

  it("converts crafted Luthiery stats to a bounded bonus exactly once", () => {
    const boosts = {
      luthiery_tone: 100,
      luthiery_sustain: 100,
      luthiery_stability: 100,
      luthiery_output: 100,
      luthiery_stage_presence: 100,
      luthiery_quality: 100,
    };
    expect(getLuthieryPerformanceBonusPercent(boosts)).toBe(8);
    expect(
      getPersonalGearRoleBonusPercent(
        {
          category: "guitar",
          subcategory: "custom_luthiery",
          rarity: "rare",
          stat_boosts: boosts,
        },
        "Lead Guitar",
      ),
    ).toBe(26);
  });

  it("does not advertise a performance bonus when the item does not fit the role", () => {
    const item = {
      category: "instrument",
      subcategory: "bass_guitar",
      rarity: "legendary",
      stat_boosts: { performance: 10 },
    };
    expect(getPersonalGearRoleBonusPercent(item, "Drums")).toBe(0);
    expect(getPersonalGearFitLabel(item, "Drums")).toBe("Not used for Drums");
  });
});
