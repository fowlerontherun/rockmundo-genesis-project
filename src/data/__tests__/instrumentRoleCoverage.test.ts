import { describe, expect, it } from "vitest";
import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
import { BAND_PERFORMANCE_ROLES } from "@/data/bandPerformanceRoles";
import { STAGE_INSTRUMENTS } from "@/features/gig-demo-3d/instrumentCatalog";
import { getBandRoleSkillSlugs } from "@/utils/skillGearPerformance";
import { JAM_INSTRUMENTS } from "@/components/jam-sessions/InstrumentSelector";
import { SONGWRITING_INSTRUMENTS } from "@/components/songwriting/SongwritingInstrumentSelector";

const knownSkills = new Set(SKILL_TREE_DEFINITIONS.map(skill => skill.slug));

describe("assignable instrument contracts", () => {
  it("every selectable physical instrument has all three skill tiers", () => {
    for (const [instrumentId, instrument] of Object.entries(STAGE_INSTRUMENTS)) {
      if (instrument.role === "vocals") continue;
      expect(BAND_PERFORMANCE_ROLES).toContain(instrument.label);
      for (const tier of ["basic", "professional", "mastery"]) {
        expect(knownSkills.has(`instruments_${tier}_${instrumentId}`)).toBe(true);
      }
      expect(getBandRoleSkillSlugs(instrument.label)).toEqual([
        `instruments_basic_${instrumentId}`,
        `instruments_professional_${instrumentId}`,
        `instruments_mastery_${instrumentId}`,
      ]);
    }
  });

  it("covers vocal and rap roles with their own canonical skill tracks", () => {
    for (const [instrumentId, instrument] of Object.entries(STAGE_INSTRUMENTS)) {
      if (instrument.role !== "vocals") continue;
      const slugs = getBandRoleSkillSlugs(instrument.label);
      expect(BAND_PERFORMANCE_ROLES).toContain(instrument.label);
      expect(slugs).toEqual([
        `instruments_basic_${instrumentId}`,
        `instruments_professional_${instrumentId}`,
        `instruments_mastery_${instrumentId}`,
      ]);
      for (const slug of slugs) expect(knownSkills.has(slug)).toBe(true);
    }
    expect(getBandRoleSkillSlugs("DJ Scratching")).toContain("instruments_basic_turntablism");
  });

  it("every jam and songwriting selection points at a real trainable skill", () => {
    const jamSlugs = JAM_INSTRUMENTS.map(item => item.value);
    const songwritingSlugs = SONGWRITING_INSTRUMENTS.map(item => item.slug);
    expect(new Set(jamSlugs).size).toBe(jamSlugs.length);
    expect(new Set(songwritingSlugs).size).toBe(songwritingSlugs.length);
    for (const slug of [...jamSlugs, ...songwritingSlugs]) {
      expect(knownSkills.has(slug)).toBe(true);
    }
  });
});
