import { describe, expect, it } from "vitest";
import { STAGE_INSTRUMENTS } from "@/features/gig-demo-3d/instrumentCatalog";
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

  it("rejects cross-instrument bonuses for every other specialist instrument", () => {
    const physical = Object.entries(STAGE_INSTRUMENTS)
      .filter(([, definition]) => definition.role !== "vocals");
    for (const [roleInstrumentId, roleInstrument] of physical) {
      for (const [equipmentInstrumentId] of physical) {
        expect(personalGearMatchesRole("instrument", equipmentInstrumentId, roleInstrument.label),
          `${roleInstrument.label} must only match its own ${roleInstrumentId} instrument (got ${equipmentInstrumentId})`,
        ).toBe(equipmentInstrumentId === roleInstrumentId);
      }
    }
  });

  it("keeps only explicit legacy generic instrument aliases for specific roles", () => {
    expect(personalGearMatchesRole("instrument", "bass", "Bass Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "bass", "Upright Bass")).toBe(false);
    expect(personalGearMatchesRole("instrument", "drums", "Rock Drums")).toBe(true);
    expect(personalGearMatchesRole("instrument", "cymbals", "Rock Drums")).toBe(true);
    expect(personalGearMatchesRole("instrument", "cymbals", "Jazz Drums")).toBe(true);
    expect(personalGearMatchesRole("instrument", "cymbals", "Electronic Drums")).toBe(false);
    expect(personalGearMatchesRole("instrument", "cymbals", "Bass Guitar")).toBe(false);
    expect(personalGearMatchesRole("instrument", "drums", "Jazz Drums")).toBe(false);
    expect(personalGearMatchesRole("instrument", "guitar", "Electric Guitar")).toBe(true);
    expect(personalGearMatchesRole("instrument", "guitar", "12-String Guitar")).toBe(false);
    expect(personalGearMatchesRole("instrument", "synthesizer", "Analog Synthesizer")).toBe(true);
    expect(personalGearMatchesRole("instrument", "synthesizer", "Digital Synthesizer")).toBe(false);
    expect(personalGearMatchesRole("instrument", "alto_sax", "Tenor Saxophone")).toBe(false);
    expect(personalGearMatchesRole("instrument", "jazz_piano", "Classical Piano")).toBe(false);
    expect(personalGearMatchesRole("instrument", "upright_bass", "Bass Guitar")).toBe(false);
    expect(personalGearMatchesRole("instrument", "jazz_drums", "Rock Drums")).toBe(false);
    expect(personalGearMatchesRole("amplifier", "guitar_amp", "Electric Guitar")).toBe(true);
    expect(personalGearMatchesRole("guitar", "custom_luthiery", "Lead Guitar")).toBe(true);
  });

  it("matches every selectable specialist to the exact buyable instrument type", () => {
    for (const [subcategory, instrument] of Object.entries(STAGE_INSTRUMENTS)) {
      if (instrument.role === "vocals") continue;
      expect(personalGearMatchesRole("instrument", subcategory, instrument.label)).toBe(true);
    }
    expect(personalGearMatchesRole("instrument", "violin", "Cello")).toBe(false);
    expect(personalGearMatchesRole("instrument", "alto_sax", "Tenor Saxophone")).toBe(false);
    expect(personalGearMatchesRole("instrument", "turntablism", "DJ Scratching")).toBe(true);
  });

  it("matches microphones to assigned singing and rap roles", () => {
    for (const role of ["Vocal & Performance Skills", "Rapping", "Freestyle", "Battle Rap", "Flow & Cadence", "Rap Songwriting", "Ad-Libs & Vocal FX"]) {
      expect(personalGearMatchesRole("recording", "dynamic_mic", role)).toBe(true);
      expect(personalGearMatchesRole("instrument", "flute", role)).toBe(false);
    }
  });

});
