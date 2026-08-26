import { describe, expect, it } from "vitest";
import {
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
