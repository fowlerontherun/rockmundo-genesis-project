import type { CraftingMaterial } from "@/hooks/useCraftingSystem";
import type { SkillProgressRecord } from "@/hooks/useSkillSystem.types";

export type LuthieryInstrumentKind = "electric_guitar" | "electric_bass";
export type LuthieryPartSlot = "body" | "neck" | "fretboard" | "electronics" | "hardware";
export type LuthieryTier = "basic" | "professional" | "mastery";

export interface LuthieryRequirement {
  tier: LuthieryTier;
  value: number;
}

export interface LuthieryShape {
  id: string;
  name: string;
  instrumentKinds: LuthieryInstrumentKind[];
  requirement: LuthieryRequirement;
  bodyPath: string;
  difficultyPenalty: number;
}

export interface LuthieryMaterialOption {
  id: string;
  label: string;
  slot: LuthieryPartSlot | "finish";
  catalogNames: string[];
  requirement: LuthieryRequirement;
  traits: Partial<LuthieryProjectedStats>;
}

export interface LuthieryProjectedStats {
  tone: number;
  sustain: number;
  stability: number;
  output: number;
  stagePresence: number;
}

export interface LuthieryBuildSelection {
  instrumentKind: LuthieryInstrumentKind;
  shapeId: string;
  colour: string;
  finishId: string;
  parts: Record<LuthieryPartSlot, string>;
}

export const LUTHIERY_SKILL_SLUGS: Record<LuthieryTier, string> = {
  basic: "luthiery_basic_technical",
  professional: "luthiery_professional_technical",
  mastery: "luthiery_mastery_technical",
};

export const LUTHIERY_PART_LABELS: Record<LuthieryPartSlot, string> = {
  body: "Body",
  neck: "Neck",
  fretboard: "Fretboard",
  electronics: "Electronics",
  hardware: "Hardware",
};

export const LUTHIERY_PART_ORDER: LuthieryPartSlot[] = [
  "body",
  "neck",
  "fretboard",
  "electronics",
  "hardware",
];

const req = (tier: LuthieryTier, value: number): LuthieryRequirement => ({ tier, value });

export const LUTHIERY_SHAPES: LuthieryShape[] = [
  {
    id: "double-cut",
    name: "Classic Double Cut",
    instrumentKinds: ["electric_guitar"],
    requirement: req("basic", 0),
    bodyPath: "M92 47 C60 39 37 49 32 69 C24 93 42 113 64 111 C78 110 84 123 99 129 C115 137 137 127 146 109 C156 89 150 62 127 51 C116 46 104 46 92 47 Z",
    difficultyPenalty: 0,
  },
  {
    id: "offset",
    name: "Offset",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("basic", 75),
    bodyPath: "M93 43 C62 31 35 48 31 71 C27 91 38 111 58 119 C78 127 93 137 116 130 C141 122 154 104 151 82 C147 60 128 49 111 52 C105 48 100 45 93 43 Z",
    difficultyPenalty: 1,
  },
  {
    id: "single-cut",
    name: "Single Cut",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("basic", 150),
    bodyPath: "M95 43 C65 39 39 50 33 72 C27 96 43 118 67 123 C91 128 124 133 141 111 C153 95 155 71 140 58 C128 48 115 48 108 55 C103 49 100 46 95 43 Z",
    difficultyPenalty: 2,
  },
  {
    id: "v-shape",
    name: "V",
    instrumentKinds: ["electric_guitar"],
    requirement: req("basic", 225),
    bodyPath: "M91 49 L36 65 L74 126 L96 96 L119 126 L151 65 L103 49 Z",
    difficultyPenalty: 4,
  },
  {
    id: "angular",
    name: "Angular",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("professional", 150),
    bodyPath: "M86 43 L35 57 L55 86 L32 117 L82 112 L105 132 L120 99 L153 87 L128 63 L148 43 L106 51 Z",
    difficultyPenalty: 5,
  },
  {
    id: "war-axe",
    name: "War Axe",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("professional", 400),
    bodyPath: "M88 43 L30 53 L51 78 L24 96 L63 103 L48 132 L91 113 L111 134 L121 103 L157 93 L132 76 L153 48 L108 57 Z",
    difficultyPenalty: 7,
  },
  {
    id: "razor",
    name: "Razor",
    instrumentKinds: ["electric_guitar"],
    requirement: req("mastery", 250),
    bodyPath: "M91 41 L28 61 L65 77 L31 115 L81 105 L97 136 L111 101 L158 116 L130 79 L158 58 L108 61 Z",
    difficultyPenalty: 8,
  },
  {
    id: "monolith-bass",
    name: "Monolith Bass",
    instrumentKinds: ["electric_bass"],
    requirement: req("mastery", 500),
    bodyPath: "M91 39 L50 44 L31 75 L45 121 L79 132 L104 114 L126 132 L151 111 L148 66 L119 45 Z",
    difficultyPenalty: 8,
  },
];

export const LUTHIERY_COLOURS = [
  { id: "midnight", label: "Midnight Black", value: "#141821" },
  { id: "ivory", label: "Ivory", value: "#e7e0cf" },
  { id: "cherry", label: "Cherry Red", value: "#8f2435" },
  { id: "cobalt", label: "Cobalt Blue", value: "#235f9f" },
  { id: "forest", label: "Forest Green", value: "#245b43" },
  { id: "gold", label: "Stage Gold", value: "#b8892f" },
  { id: "violet", label: "Electric Violet", value: "#6f42a8" },
  { id: "hot-pink", label: "Hot Pink", value: "#c8377d" },
  { id: "natural", label: "Natural", value: "#9b6a3d" },
];

export const LUTHIERY_MATERIAL_OPTIONS: LuthieryMaterialOption[] = [
  // Body
  { id: "body-pine", label: "Pine", slot: "body", catalogNames: ["Pine Body Blank"], requirement: req("basic", 0), traits: { tone: -2, sustain: -2, stagePresence: 1 } },
  { id: "body-poplar", label: "Poplar", slot: "body", catalogNames: ["Poplar Body Blank"], requirement: req("basic", 40), traits: { tone: 0, sustain: 0, stability: 1 } },
  { id: "body-alder", label: "Alder", slot: "body", catalogNames: ["Alder Body Blank"], requirement: req("basic", 90), traits: { tone: 3, sustain: 1, stability: 2 } },
  { id: "body-ash", label: "Ash", slot: "body", catalogNames: ["Ash Body Blank"], requirement: req("basic", 160), traits: { tone: 4, sustain: 2, stagePresence: 1 } },
  { id: "body-mahogany", label: "Mahogany", slot: "body", catalogNames: ["Mahogany Body Blank"], requirement: req("professional", 80), traits: { tone: 5, sustain: 5, stability: 2 } },
  { id: "body-korina", label: "Korina", slot: "body", catalogNames: ["Korina Body Blank"], requirement: req("professional", 400), traits: { tone: 6, sustain: 5, stagePresence: 3 } },

  // Neck
  { id: "neck-maple", label: "Maple", slot: "neck", catalogNames: ["Maple Neck Blank"], requirement: req("basic", 0), traits: { sustain: 2, stability: 4 } },
  { id: "neck-pine", label: "Pine stock", slot: "neck", catalogNames: ["Pine Body Blank"], requirement: req("basic", 75), traits: { stability: -2, sustain: -1 } },
  { id: "neck-alder", label: "Alder stock", slot: "neck", catalogNames: ["Alder Body Blank"], requirement: req("basic", 150), traits: { stability: 1, sustain: 1 } },
  { id: "neck-mahogany", label: "Mahogany stock", slot: "neck", catalogNames: ["Mahogany Body Blank"], requirement: req("professional", 150), traits: { tone: 2, sustain: 4, stability: 2 } },
  { id: "neck-korina", label: "Korina stock", slot: "neck", catalogNames: ["Korina Body Blank"], requirement: req("mastery", 250), traits: { tone: 3, sustain: 4, stability: 4 } },

  // Fretboard
  { id: "fret-maple", label: "Maple", slot: "fretboard", catalogNames: ["Maple Neck Blank"], requirement: req("basic", 0), traits: { tone: 2, stability: 2 } },
  { id: "fret-rosewood", label: "Rosewood", slot: "fretboard", catalogNames: ["Rosewood Fretboard"], requirement: req("basic", 100), traits: { tone: 4, sustain: 2 } },
  { id: "fret-ebony", label: "Ebony", slot: "fretboard", catalogNames: ["Ebony Fretboard"], requirement: req("professional", 250), traits: { tone: 4, sustain: 4, stability: 4 } },
  { id: "fret-brazilian", label: "Brazilian Rosewood", slot: "fretboard", catalogNames: ["Brazilian Rosewood Set"], requirement: req("mastery", 500), traits: { tone: 7, sustain: 5, stagePresence: 2 } },

  // Electronics
  { id: "elec-single", label: "Single Coil", slot: "electronics", catalogNames: ["Single Coil Pickup", "Single-Coil Pickup Set"], requirement: req("basic", 0), traits: { tone: 2, output: 1 } },
  { id: "elec-humbucker", label: "Humbucker", slot: "electronics", catalogNames: ["Humbucker Pickup", "Humbucker Pickup Set"], requirement: req("basic", 80), traits: { tone: 3, output: 4 } },
  { id: "elec-alnico", label: "Alnico V", slot: "electronics", catalogNames: ["Alnico V Pickup"], requirement: req("basic", 170), traits: { tone: 4, output: 4 } },
  { id: "elec-paf", label: "PAF-style", slot: "electronics", catalogNames: ["PAF Clone Pickup"], requirement: req("professional", 150), traits: { tone: 6, output: 4 } },
  { id: "elec-active", label: "Active High Output", slot: "electronics", catalogNames: ["Active EMG Pickup", "Active EMG Pickup Set"], requirement: req("professional", 350), traits: { tone: 3, output: 8, stagePresence: 2 } },
  { id: "elec-boutique", label: "Hand-wound Boutique", slot: "electronics", catalogNames: ["Hand-Wound Boutique Pickup"], requirement: req("mastery", 350), traits: { tone: 8, output: 6, stagePresence: 2 } },

  // Hardware
  { id: "hw-standard", label: "Standard Hardware", slot: "hardware", catalogNames: ["Standard Tuners Set", "Bridge and Hardware Kit"], requirement: req("basic", 0), traits: { stability: 1, sustain: 1 } },
  { id: "hw-locking", label: "Locking Hardware", slot: "hardware", catalogNames: ["Locking Tuners Set"], requirement: req("basic", 100), traits: { stability: 4, sustain: 1 } },
  { id: "hw-tom", label: "Fixed Bridge", slot: "hardware", catalogNames: ["Tune-O-Matic Bridge", "Bridge and Hardware Kit"], requirement: req("basic", 160), traits: { stability: 3, sustain: 4 } },
  { id: "hw-trem", label: "Tremolo", slot: "hardware", catalogNames: ["Tremolo Bridge"], requirement: req("professional", 100), traits: { stability: 1, sustain: 2, stagePresence: 3 } },
  { id: "hw-floyd", label: "Double-locking Tremolo", slot: "hardware", catalogNames: ["Floyd Rose Tremolo"], requirement: req("professional", 350), traits: { stability: 6, sustain: 2, stagePresence: 5 } },
  { id: "hw-gold", label: "Gold Hardware", slot: "hardware", catalogNames: ["Gold Hardware Set"], requirement: req("mastery", 250), traits: { stability: 4, sustain: 3, stagePresence: 8 } },

  // Finish
  { id: "finish-satin", label: "Satin Lacquer", slot: "finish", catalogNames: ["Satin Lacquer"], requirement: req("basic", 0), traits: { stagePresence: 0 } },
  { id: "finish-gloss", label: "Gloss Nitrocellulose", slot: "finish", catalogNames: ["Gloss Nitrocellulose"], requirement: req("basic", 100), traits: { stagePresence: 2 } },
  { id: "finish-burst", label: "Burst Sunburst", slot: "finish", catalogNames: ["Burst Sunburst Finish"], requirement: req("professional", 150), traits: { stagePresence: 4 } },
  { id: "finish-metalflake", label: "Metallic Flake", slot: "finish", catalogNames: ["Metallic Flake Finish"], requirement: req("professional", 300), traits: { stagePresence: 7 } },
  { id: "finish-artwork", label: "Custom Artwork", slot: "finish", catalogNames: ["Custom Artwork Finish"], requirement: req("mastery", 350), traits: { stagePresence: 10 } },
];

export const DEFAULT_LUTHIERY_SELECTION: LuthieryBuildSelection = {
  instrumentKind: "electric_guitar",
  shapeId: "double-cut",
  colour: "#141821",
  finishId: "finish-satin",
  parts: {
    body: "body-pine",
    neck: "neck-maple",
    fretboard: "fret-maple",
    electronics: "elec-single",
    hardware: "hw-standard",
  },
};

export function getLuthieryProgress(progress: SkillProgressRecord[]): Record<LuthieryTier, number> {
  return {
    basic: Number(progress.find((p) => p.skill_slug === LUTHIERY_SKILL_SLUGS.basic)?.current_level ?? 0),
    professional: Number(progress.find((p) => p.skill_slug === LUTHIERY_SKILL_SLUGS.professional)?.current_level ?? 0),
    mastery: Number(progress.find((p) => p.skill_slug === LUTHIERY_SKILL_SLUGS.mastery)?.current_level ?? 0),
  };
}

export function isLuthieryRequirementMet(
  requirement: LuthieryRequirement,
  progress: SkillProgressRecord[] | Record<LuthieryTier, number>,
): boolean {
  const values = Array.isArray(progress) ? getLuthieryProgress(progress) : progress;
  return values[requirement.tier] >= requirement.value;
}

export function formatLuthieryRequirement(requirement: LuthieryRequirement): string {
  const label = requirement.tier === "basic" ? "Basic" : requirement.tier === "professional" ? "Professional" : "Mastery";
  return requirement.value <= 0 ? `${label} Luthiery` : `${label} Luthiery ${requirement.value}`;
}

export function getMaterialOption(id: string): LuthieryMaterialOption | undefined {
  return LUTHIERY_MATERIAL_OPTIONS.find((option) => option.id === id);
}

export function resolveCatalogMaterial(
  option: LuthieryMaterialOption,
  catalog: CraftingMaterial[],
): CraftingMaterial | undefined {
  const lowered = new Map(catalog.map((material) => [material.name.toLowerCase(), material]));
  for (const name of option.catalogNames) {
    const match = lowered.get(name.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

export function getShapeForSelection(selection: LuthieryBuildSelection): LuthieryShape {
  return (
    LUTHIERY_SHAPES.find(
      (shape) => shape.id === selection.shapeId && shape.instrumentKinds.includes(selection.instrumentKind),
    ) ??
    LUTHIERY_SHAPES.find(
      (shape) => shape.instrumentKinds.includes(selection.instrumentKind) && shape.requirement.value === 0,
    ) ??
    LUTHIERY_SHAPES[0]
  );
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateLuthierySkillScore(progress: SkillProgressRecord[]): number {
  const values = getLuthieryProgress(progress);
  if (values.mastery > 0) return clamp(80 + (values.mastery / 650) * 20);
  if (values.professional > 0) return clamp(55 + (values.professional / 650) * 25);
  return clamp(10 + (values.basic / 250) * 45);
}

export function calculateProjectedLuthieryOutcome(
  selection: LuthieryBuildSelection,
  catalog: CraftingMaterial[],
  progress: SkillProgressRecord[],
): { quality: number; materialQuality: number; skillScore: number; stats: LuthieryProjectedStats } {
  const selectedOptions = [
    ...LUTHIERY_PART_ORDER.map((slot) => getMaterialOption(selection.parts[slot])),
    getMaterialOption(selection.finishId),
  ].filter((option): option is LuthieryMaterialOption => Boolean(option));

  const qualityValues = selectedOptions.map((option) => {
    const material = resolveCatalogMaterial(option, catalog);
    return clamp(((material?.quality_tier ?? 1) / 5) * 100);
  });

  const materialQuality = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length)
    : 20;

  const skillScore = Math.round(calculateLuthierySkillScore(progress));
  const shape = getShapeForSelection(selection);
  const quality = Math.round(clamp(materialQuality * 0.7 + skillScore * 0.3 - shape.difficultyPenalty));

  const stats: LuthieryProjectedStats = {
    tone: 45,
    sustain: 45,
    stability: 45,
    output: selection.instrumentKind === "electric_bass" ? 48 : 45,
    stagePresence: 40,
  };

  for (const option of selectedOptions) {
    for (const [key, value] of Object.entries(option.traits) as [keyof LuthieryProjectedStats, number][]) {
      stats[key] += value ?? 0;
    }
  }

  const qualityLift = Math.round((quality - 50) / 8);
  stats.tone = clamp(stats.tone + qualityLift);
  stats.sustain = clamp(stats.sustain + qualityLift);
  stats.stability = clamp(stats.stability + qualityLift);
  stats.output = clamp(stats.output + qualityLift);
  stats.stagePresence = clamp(stats.stagePresence + Math.round(qualityLift / 2));

  return { quality, materialQuality, skillScore, stats };
}
