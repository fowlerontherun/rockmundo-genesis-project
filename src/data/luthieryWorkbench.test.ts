import { describe, expect, it } from "vitest";

import {
  DEFAULT_LUTHIERY_SELECTION,
  LUTHIERY_SHAPES,
  calculateProjectedLuthieryOutcome,
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
  it("keeps advanced body shapes locked until the required Luthiery tier and value", () => {
    const warAxe = LUTHIERY_SHAPES.find((shape) => shape.id === "war-axe");
    expect(warAxe).toBeDefined();

    const basicOnly = [skill("luthiery_basic_technical", 250)];
    const professionalLow = [
      skill("luthiery_basic_technical", 250),
      skill("luthiery_professional_technical", 399),
    ];
    const professionalReady = [
      skill("luthiery_basic_technical", 250),
      skill("luthiery_professional_technical", 400),
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
      [skill("luthiery_basic_technical", 40)],
    );

    const premiumSelection: LuthieryBuildSelection = {
      instrumentKind: "electric_guitar",
      shapeId: "razor",
      colour: "#c8377d",
      finishId: "finish-artwork",
      parts: {
        body: "body-korina",
        neck: "neck-mahogany",
        fretboard: "fret-brazilian",
        electronics: "elec-boutique",
        hardware: "hw-gold",
      },
    };
    const premium = calculateProjectedLuthieryOutcome(premiumSelection, catalog, [
      skill("luthiery_basic_technical", 250),
      skill("luthiery_professional_technical", 650),
      skill("luthiery_mastery_technical", 650),
    ]);

    expect(premium.materialQuality).toBeGreaterThan(starter.materialQuality);
    expect(premium.skillScore).toBeGreaterThan(starter.skillScore);
    expect(premium.quality).toBeGreaterThan(starter.quality);
    expect(premium.stats.tone).toBeGreaterThan(starter.stats.tone);
    expect(premium.stats.stagePresence).toBeGreaterThan(starter.stats.stagePresence);
  });

  it("uses exactly five structural parts for every custom instrument selection", () => {
    expect(Object.keys(DEFAULT_LUTHIERY_SELECTION.parts).sort()).toEqual(
      ["body", "electronics", "fretboard", "hardware", "neck"].sort(),
    );
  });
});
