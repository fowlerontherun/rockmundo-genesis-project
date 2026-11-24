import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SONGWRITING_INSTRUMENTS } from "@/components/songwriting/SongwritingInstrumentSelector";
import {
  calculateSongwritingInstrumentBonus,
  resolveSongwritingInstrumentSkill,
} from "../songwritingInstrumentSkills";

const instruments = [
  { slug: "instruments_basic_acoustic_guitar", alsoMatch: ["guitar"] },
  { slug: "instruments_basic_electric_guitar", alsoMatch: ["guitar"] },
  { slug: "instruments_basic_bass_guitar", alsoMatch: ["bass"] },
  { slug: "instruments_basic_vocal_performance", alsoMatch: ["vocals", "basic_singing"] },
  { slug: "instruments_basic_jazz_piano", alsoMatch: ["piano", "basic_keyboard"] },
  { slug: "instruments_basic_rhodes", alsoMatch: ["basic_keyboard"] },
] as const;

describe("songwriting instrument skills", () => {
  it("keeps the authoritative SQL fallback catalogue in sync with the selector", () => {
    const sql = readFileSync(
      "supabase/migrations/20261124200736_recognize_legacy_songwriting_instrument_skills.sql",
      "utf8",
    );
    for (const instrument of SONGWRITING_INSTRUMENTS) {
      if (instrument.alsoMatch.length === 0) continue;
      expect(sql).toContain(`'${instrument.slug}'`);
      for (const alias of instrument.alsoMatch) expect(sql).toContain(`'${alias}'`);
    }
    expect(sql).toContain("songwriting_selected_instrument_bonus(p_profile_id,v_project.instruments)");
    expect(sql).toContain("family_use=1");
    expect(sql).toContain("'historical_project_preserved'");
  });

  it("recognises existing general skills while labelling them as general", () => {
    const skill = resolveSongwritingInstrumentSkill(instruments[0], [
      { skill_slug: "guitar", current_level: 16 },
    ]);
    expect(skill).toEqual({ level: 16, source: "general", generalFamily: "guitar" });
    expect(calculateSongwritingInstrumentBonus([instruments[0].slug], instruments, [
      { skill_slug: "guitar", current_level: 16 },
    ])).toBe(12);
  });

  it("does not multiply one general skill across several guitars", () => {
    const progress = [{ skill_slug: "guitar", current_level: 70 }];
    expect(calculateSongwritingInstrumentBonus(
      [instruments[0].slug, instruments[1].slug, instruments[0].slug], instruments, progress,
    )).toBe(15);
  });

  it("does not double-count equivalent piano and keyboard general skills", () => {
    const progress = [
      { skill_slug: "piano", current_level: 12 },
      { skill_slug: "basic_keyboard", current_level: 16 },
    ];
    expect(calculateSongwritingInstrumentBonus(
      [instruments[4].slug, instruments[5].slug], instruments, progress,
    )).toBe(12);
  });

  it("prefers specialist skills and includes professional and mastery tiers", () => {
    const progress = [
      { skill_slug: "guitar", current_level: 80 },
      { skill_slug: "instruments_basic_acoustic_guitar", current_level: 10 },
      { skill_slug: "instruments_professional_acoustic_guitar", current_level: 22 },
      { skill_slug: "instruments_mastery_acoustic_guitar", current_level: 17 },
    ];
    expect(resolveSongwritingInstrumentSkill(instruments[0], progress)).toEqual({
      level: 22, source: "specialist", generalFamily: null,
    });
    expect(calculateSongwritingInstrumentBonus([instruments[0].slug], instruments, progress)).toBe(30);
  });

  it("does not invent specialist skills and caps bonus at 150", () => {
    expect(resolveSongwritingInstrumentSkill(instruments[2], [
      { skill_slug: "guitar", current_level: 100 },
    ]).level).toBe(0);
    const progress = instruments.map((entry) => ({ skill_slug: entry.slug, current_level: 100 }));
    expect(calculateSongwritingInstrumentBonus(instruments.map((entry) => entry.slug), instruments, progress)).toBe(150);
  });

  it("uses half rates for later general instruments and respects null/invalid levels", () => {
    const progress = [
      { skill_slug: "guitar", current_level: null },
      { skill_slug: "bass", current_level: Number.NaN },
      { skill_slug: "vocals", current_level: 10 },
    ];
    expect(resolveSongwritingInstrumentSkill(instruments[0], progress).source).toBe("none");
    expect(calculateSongwritingInstrumentBonus(
      [instruments[0].slug, instruments[1].slug, instruments[2].slug, instruments[4].slug, instruments[3].slug],
      instruments, progress,
    )).toBe(4);
  });
});
