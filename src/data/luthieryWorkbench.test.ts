import { describe, expect, it } from "vitest";

import {
  DEFAULT_LUTHIERY_SELECTION,
  LUTHIERY_SHAPES,
  calculateProjectedLuthieryOutcome,
  getLuthieryBuildReadiness,
  getLuthieryBuildRequirements,
  isLuthieryRequirementMet,
  resolveCatalogMaterial,
  type LuthieryBuildSelection,
} from "./luthieryWorkbench";
import type { CraftingMaterial } from "@/hooks/useCraftingSystem";
import type { SkillProgressRecord } from "@/hooks/useSkillSystem.types";

const material = (id: string, name: string, quality_tier: number): CraftingMaterial => ({
  id,
  name,
  category: "test",
  rarity: quality_tier >= 4 ? "epic" : quality_tier >= 3 ? "rare" : "common",
  quality_tier,
  base_cost: quality_tier * 100,
  description: null,
  image_url: null,
});

const catalog: CraftingMaterial[] = [
  material("pine", "Pine Body Blank", 1),
  material("poplar", "Poplar Body Blank", 1),
  material("alder", "Alder Body Blank", 2),
  material("ash", "Ash Body Blank", 2),
  material("mahogany", "Mahogany Body Blank", 3),
  material("korina", "Korina Body Blank", 4),
  material("maple", "Maple Neck Blank", 2),
  material("rosewood", "Rosewood Fretboard", 3),
  material("ebony", "Ebony Fretboard", 4),
  material("brazilian", "Brazilian Rosewood Set", 5),
  material("single", "Single Coil Pickup", 1),
  material("humbucker", "Humbucker Pickup", 1),
  material("alnico", "Alnico V Pickup", 2),
  material("paf", "PAF Clone Pickup", 3),
  material("active", "Active EMG Pickup", 3),
  material("boutique", "Hand-Wound Boutique Pickup", 4),
  material("tuners", "Standard Tuners Set", 1),
  material("locking", "Locking Tuners Set", 2),
  material("tom", "Tune-O-Matic Bridge", 1),
  material("trem", "Tremolo Bridge", 2),
  material("floyd", "Floyd Rose Tremolo", 3),
  material("gold", "Gold Hardware Set", 4),
  material("satin", "Satin Lacquer", 1),
  material("gloss", "Gloss Nitrocellulose", 2),
  material("burst", "Burst Sunburst Finish", 3),
  material("flake", "Metallic Flake Finish", 3),
  material("art", "Custom Artwork Finish", 4),
];

const skill = (slug: string, level: number): SkillProgressRecord => ({
  id: `${slug}-progress`,
  profile_id: "profile",
  skill_slug: slug,
  current_level: level,
  current_xp: 0,
  required_xp: 100,
});

describe("Luthiery workbench rules", () => {
  it("has a level-zero starter shape for both guitars and basses", () => {
    for (const instrumentKind of ["electric_guitar", "electric_bass"] as const) {
      expect(
        LUTHIERY_SHAPES.some(
          (shape) =>
            shape.instrumentKinds.includes(instrumentKind) &&
            shape.requirement.tier === "basic" &&
            shape.requirement.value === 0,
        ),
      ).toBe(true);
    }
  });

  it("keeps advanced body shapes locked until the required Luthiery tier and value", () => {
    const warAxe = LUTHIERY_SHAPES.find((shape) => shape.id === "war-axe");
    expect(warAxe).toBeDefined();

    const basicOnly = [skill("luthiery_basic_technical", 20)];
    const professionalLow = [
      skill("luthiery_basic_technical", 20),
      skill("luthiery_professional_technical", 11),
    ];
    const professionalReady = [
      skill("luthiery_basic_technical", 20),
      skill("luthiery_professional_technical", 12),
    ];

    expect(isLuthieryRequirementMet(warAxe!.requirement, basicOnly)).toBe(false);
    expect(isLuthieryRequirementMet(warAxe!.requirement, professionalLow)).toBe(false);
    expect(isLuthieryRequirementMet(warAxe!.requirement, professionalReady)).toBe(true);
  });

  it("resolves material aliases so old and newer catalogue names remain usable", () => {
    const singleCoilOption = {
      id: "test",
      label: "Single Coil",
      slot: "electronics" as const,
      catalogNames: ["Single Coil Pickup", "Single-Coil Pickup Set"],
      requirement: { tier: "basic" as const, value: 0 },
      traits: {},
    };

    expect(resolveCatalogMaterial(singleCoilOption, [material("legacy", "Single-Coil Pickup Set", 2)])?.id).toBe("legacy");
  });

  it("projects a better result from premium materials and Master Luthier skill", () => {
    const starter = calculateProjectedLuthieryOutcome(
      DEFAULT_LUTHIERY_SELECTION,
      catalog,
      [skill("luthiery_basic_technical", 4)],
    );

    const premiumSelection: LuthieryBuildSelection = {
      instrumentName: "Razor Queen",
      instrumentKind: "electric_guitar",
      shapeId: "razor",
      colour: "#c8377d",
      finishId: "finish-artwork",
      decal: { id: "lightning", x: 50, y: 50, scale: 100, rotation: 0, colour: "#f5f5f5" },
      parts: {
        body: "body-korina",
        neck: "neck-mahogany",
        fretboard: "fret-brazilian",
        electronics: "elec-boutique",
        hardware: "hw-gold",
      },
    };
    const premium = calculateProjectedLuthieryOutcome(premiumSelection, catalog, [
      skill("luthiery_basic_technical", 20),
      skill("luthiery_professional_technical", 20),
      skill("luthiery_mastery_technical", 20),
    ]);

    expect(premium.materialQuality).toBeGreaterThan(starter.materialQuality);
    expect(premium.skillScore).toBeGreaterThan(starter.skillScore);
    expect(premium.quality).toBeGreaterThan(starter.quality);
    expect(premium.stats.tone).toBeGreaterThan(starter.stats.tone);
    expect(premium.stats.stagePresence).toBeGreaterThan(starter.stats.stagePresence);
  });

  it("aggregates shared material requirements across the five-part build", () => {
    const named = { ...DEFAULT_LUTHIERY_SELECTION, instrumentName: "Starter One" };
    const result = getLuthieryBuildRequirements(named, catalog);
    const maple = result.requirements.find((entry) => entry.material.name === "Maple Neck Blank");

    expect(maple?.quantity).toBe(2);
    expect(maple?.sources).toEqual(expect.arrayContaining(["Neck", "Fretboard"]));
  });

  it("blocks review when stock is short and accepts a fully stocked named build", () => {
    const selection = { ...DEFAULT_LUTHIERY_SELECTION, instrumentName: "Road One" };
    const skills = [skill("luthiery_basic_technical", 20)];
    const requirements = getLuthieryBuildRequirements(selection, catalog).requirements;
    const stocked = requirements.map((entry, index) => ({
      id: `stock-${index}`,
      profile_id: "profile",
      material_id: entry.material.id,
      quantity: entry.quantity,
      acquired_at: "2026-10-04T00:00:00.000Z",
      material: entry.material,
    }));

    expect(getLuthieryBuildReadiness(selection, catalog, [], skills).ready).toBe(false);
    expect(getLuthieryBuildReadiness(selection, catalog, stocked, skills)).toMatchObject({
      ready: true,
      blockers: [],
    });
  });

  it("uses exactly five structural parts for every custom instrument selection", () => {
    expect(Object.keys(DEFAULT_LUTHIERY_SELECTION.parts).sort()).toEqual(
      ["body", "electronics", "fretboard", "hardware", "neck"].sort(),
    );
  });
});
