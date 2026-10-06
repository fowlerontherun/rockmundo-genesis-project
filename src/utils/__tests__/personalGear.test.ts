import { describe, expect, it } from "vitest";
import {
  getCanonicalEquipmentType,
  getLuthieryPerformanceBonusPercent,
  getPersonalGearFitLabel,
  getPersonalGearRoleBonusPercent,
  personalGearMatchesRole,
} from "../personalGear";

describe("personal gear role fit", () => {
  it("normalizes legacy and current guitar catalogue types", () => {
    expect(getCanonicalEquipmentType("instrument", "guitar")).toBe("electric_guitar");
    expect(getCanonicalEquipmentType("guitar", "electric")).toBe("electric_guitar");
    expect(getCanonicalEquipmentType("instrument", "acoustic_guitar")).toBe("acoustic_guitar");
    expect(getCanonicalEquipmentType("guitar", "acoustic")).toBe("acoustic_guitar");
    expect(getCanonicalEquipmentType("instrument", "classical_guitar")).toBe("classical_guitar");
  });

  it("keeps acoustic and classical guitars distinct from lead electric-guitar gear", () => {
    expect(personalGearMatchesRole("instrument", "electric_guitar", "Lead Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "acoustic_guitar", "Lead Guitar")).toBe(false);
    expect(personalGearMatchesRole("instrument", "acoustic_guitar", "Rhythm Guitar")).toBe(true);
    expect(personalGearMatchesRole("guitar", "acoustic", "Rhythm Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "classical_guitar", "Rhythm Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "electric_guitar", "Drums")).toBe(false);
  });

  it("maps drum kits, electronic drums and cymbals to drummers", () => {
    expect(personalGearMatchesRole("instrument", "drums", "Drums")).toBe(true);
    expect(personalGearMatchesRole("instrument", "electronic_drums", "Drummer")).toBe(true);
    expect(personalGearMatchesRole("instrument", "cymbals", "Drums")).toBe(true);
  });

  it("maps microphone variants to vocals but excludes audio interfaces", () => {
    for (const subcategory of ["microphone", "dynamic_mic", "condenser_mic", "condenser", "ribbon_mic", "tube_mic"]) {
      expect(personalGearMatchesRole("recording", subcategory, "Lead Vocals")).toBe(true);
    }
    expect(personalGearMatchesRole("recording", "audio_interface", "Lead Vocals")).toBe(false);
  });

  it("maps bass, keyboard, synth and personal rig aliases explicitly", () => {
    expect(personalGearMatchesRole("instrument", "bass", "Bass")).toBe(true);
    expect(personalGearMatchesRole("instrument", "bass_guitar", "Bass Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "keyboard", "Keys")).toBe(true);
    expect(personalGearMatchesRole("instrument", "synthesizer", "Synth")).toBe(true);
    expect(personalGearMatchesRole("instrument", "midi_controller", "Keyboard")).toBe(true);
    expect(personalGearMatchesRole("amplifier", "guitar_amp", "Lead Guitar")).toBe(true);
    expect(personalGearMatchesRole("amplifier", "bass_amp", "Bass")).toBe(true);
    expect(personalGearMatchesRole("effects", "overdrive", "Rhythm Guitar")).toBe(true);
    expect(personalGearMatchesRole("stage", "wireless_mic", "Vocals")).toBe(true);
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
