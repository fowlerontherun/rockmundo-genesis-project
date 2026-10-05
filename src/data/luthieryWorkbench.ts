import { LUTHIERY_BODY_PATHS } from "@/features/luthiery/bodyShapes";
import { MAX_SKILL_LEVEL } from "@/data/skillConstants";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";
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

export type LuthieryDecalId = "none" | "lightning" | "star" | "stripes" | "target";

export interface LuthieryDecalSelection {
  id: LuthieryDecalId;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  colour: string;
}

export interface LuthieryBuildSelection {
  instrumentName: string;
  instrumentKind: LuthieryInstrumentKind;
  shapeId: string;
  colour: string;
  finishId: string;
  decal: LuthieryDecalSelection;
  parts: Record<LuthieryPartSlot, string>;
}

export interface LuthieryBuildRequirement {
  material: CraftingMaterial;
  quantity: number;
  sources: string[];
}

export interface LuthieryBuildReadiness {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  requirements: LuthieryBuildRequirement[];
}

export interface LuthieryBuildPreviewSpec {
  instrumentName: string;
  instrumentKind: LuthieryInstrumentKind;
  shapeId: string;
  shapeName: string;
  colour: string;
  finishId: string;
  finishName: string;
  decal: LuthieryDecalSelection;
  parts: Record<LuthieryPartSlot, { optionId: string; label: string; materialId: string | null; materialName: string | null }>;
  projectedQuality: number;
  projectedStats: LuthieryProjectedStats;
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
    id: "classic-bass",
    name: "Classic Bass",
    instrumentKinds: ["electric_bass"],
    requirement: req("basic", 0),
    bodyPath: LUTHIERY_BODY_PATHS["classic-bass"],
    difficultyPenalty: 0,
  },
  {
    id: "double-cut",
    name: "Classic Double Cut",
    instrumentKinds: ["electric_guitar"],
    requirement: req("basic", 0),
    bodyPath: LUTHIERY_BODY_PATHS["double-cut"],
    difficultyPenalty: 0,
  },
  {
    id: "offset",
    name: "Offset",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("basic", 6),
    bodyPath: LUTHIERY_BODY_PATHS["offset"],
    difficultyPenalty: 1,
  },
  {
    id: "single-cut",
    name: "Single Cut",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("basic", 12),
    bodyPath: LUTHIERY_BODY_PATHS["single-cut"],
    difficultyPenalty: 2,
  },
  {
    id: "v-shape",
    name: "V",
    instrumentKinds: ["electric_guitar"],
    requirement: req("basic", 18),
    bodyPath: LUTHIERY_BODY_PATHS["v-shape"],
    difficultyPenalty: 4,
  },
  {
    id: "angular",
    name: "Angular",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("professional", 5),
    bodyPath: LUTHIERY_BODY_PATHS["angular"],
    difficultyPenalty: 5,
  },
  {
    id: "war-axe",
    name: "War Axe",
    instrumentKinds: ["electric_guitar", "electric_bass"],
    requirement: req("professional", 12),
    bodyPath: LUTHIERY_BODY_PATHS["war-axe"],
    difficultyPenalty: 7,
  },
  {
    id: "razor",
    name: "Razor",
    instrumentKinds: ["electric_guitar"],
    requirement: req("mastery", 8),
    bodyPath: LUTHIERY_BODY_PATHS["razor"],
    difficultyPenalty: 8,
  },
  {
    id: "monolith-bass",
    name: "Monolith Bass",
    instrumentKinds: ["electric_bass"],
    requirement: req("mastery", 15),
    bodyPath: LUTHIERY_BODY_PATHS["monolith-bass"],
    difficultyPenalty: 8,
  },
  { id: "compact-double", name: "Compact Double Cut", instrumentKinds: ["electric_guitar"], requirement: req("basic", 4), bodyPath: LUTHIERY_BODY_PATHS["compact-double"], difficultyPenalty: 1 },
  { id: "slab-single", name: "Slab Single Cut", instrumentKinds: ["electric_guitar"], requirement: req("basic", 8), bodyPath: LUTHIERY_BODY_PATHS["slab-single"], difficultyPenalty: 1 },
  { id: "semi-hollow", name: "Semi-Hollow", instrumentKinds: ["electric_guitar"], requirement: req("professional", 8), bodyPath: LUTHIERY_BODY_PATHS["semi-hollow"], difficultyPenalty: 4 },
  { id: "jazz-bass", name: "Jazz Offset Bass", instrumentKinds: ["electric_bass"], requirement: req("basic", 6), bodyPath: LUTHIERY_BODY_PATHS["jazz-bass"], difficultyPenalty: 1 },
  { id: "modern-bass", name: "Sculpted Bass", instrumentKinds: ["electric_bass"], requirement: req("professional", 6), bodyPath: LUTHIERY_BODY_PATHS["modern-bass"], difficultyPenalty: 3 },
  { id: "short-scale-bass", name: "Short-Scale Bass", instrumentKinds: ["electric_bass"], requirement: req("basic", 3), bodyPath: LUTHIERY_BODY_PATHS["short-scale-bass"], difficultyPenalty: 1 },
];

export const LUTHIERY_DECALS: Array<{ id: LuthieryDecalId; label: string }> = [
  { id: "none", label: "None" },
  { id: "lightning", label: "Lightning" },
  { id: "star", label: "Star" },
  { id: "stripes", label: "Racing Stripes" },
  { id: "target", label: "Target" },
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
  { id: "body-poplar", label: "Poplar", slot: "body", catalogNames: ["Poplar Body Blank"], requirement: req("basic", 3), traits: { tone: 0, sustain: 0, stability: 1 } },
  { id: "body-alder", label: "Alder", slot: "body", catalogNames: ["Alder Body Blank"], requirement: req("basic", 0), traits: { tone: 3, sustain: 1, stability: 2 } },
  { id: "body-ash", label: "Ash", slot: "body", catalogNames: ["Ash Body Blank"], requirement: req("basic", 13), traits: { tone: 4, sustain: 2, stagePresence: 1 } },
  { id: "body-mahogany", label: "Mahogany", slot: "body", catalogNames: ["Mahogany Body Blank"], requirement: req("professional", 2), traits: { tone: 5, sustain: 5, stability: 2 } },
  { id: "body-korina", label: "Korina", slot: "body", catalogNames: ["Korina Body Blank"], requirement: req("professional", 12), traits: { tone: 6, sustain: 5, stagePresence: 3 } },

  // Neck
  { id: "neck-maple", label: "Maple", slot: "neck", catalogNames: ["Maple Neck Blank"], requirement: req("basic", 0), traits: { sustain: 2, stability: 4 } },
  { id: "neck-pine", label: "Pine stock", slot: "neck", catalogNames: ["Pine Body Blank"], requirement: req("basic", 6), traits: { stability: -2, sustain: -1 } },
  { id: "neck-alder", label: "Alder stock", slot: "neck", catalogNames: ["Alder Body Blank"], requirement: req("basic", 12), traits: { stability: 1, sustain: 1 } },
  { id: "neck-mahogany", label: "Mahogany stock", slot: "neck", catalogNames: ["Mahogany Body Blank"], requirement: req("professional", 5), traits: { tone: 2, sustain: 4, stability: 2 } },
  { id: "neck-korina", label: "Korina stock", slot: "neck", catalogNames: ["Korina Body Blank"], requirement: req("mastery", 8), traits: { tone: 3, sustain: 4, stability: 4 } },

  // Fretboard
  { id: "fret-maple", label: "Maple", slot: "fretboard", catalogNames: ["Maple Neck Blank"], requirement: req("basic", 0), traits: { tone: 2, stability: 2 } },
  { id: "fret-rosewood", label: "Rosewood", slot: "fretboard", catalogNames: ["Rosewood Fretboard"], requirement: req("basic", 8), traits: { tone: 4, sustain: 2 } },
  { id: "fret-ebony", label: "Ebony", slot: "fretboard", catalogNames: ["Ebony Fretboard"], requirement: req("professional", 8), traits: { tone: 4, sustain: 4, stability: 4 } },
  { id: "fret-brazilian", label: "Brazilian Rosewood", slot: "fretboard", catalogNames: ["Brazilian Rosewood Set"], requirement: req("mastery", 15), traits: { tone: 7, sustain: 5, stagePresence: 2 } },

  // Electronics
  { id: "elec-single", label: "Single Coil", slot: "electronics", catalogNames: ["Single-Coil Pickup Set", "Single Coil Pickup"], requirement: req("basic", 0), traits: { tone: 2, output: 1 } },
  { id: "elec-humbucker", label: "Humbucker", slot: "electronics", catalogNames: ["Humbucker Pickup Set", "Humbucker Pickup"], requirement: req("basic", 6), traits: { tone: 3, output: 4 } },
  { id: "elec-alnico", label: "Alnico V", slot: "electronics", catalogNames: ["Alnico V Pickup"], requirement: req("basic", 14), traits: { tone: 4, output: 4 } },
  { id: "elec-paf", label: "PAF-style", slot: "electronics", catalogNames: ["PAF Clone Pickup"], requirement: req("professional", 5), traits: { tone: 6, output: 4 } },
  { id: "elec-active", label: "Active High Output", slot: "electronics", catalogNames: ["Active EMG Pickup Set", "Active EMG Pickup"], requirement: req("professional", 11), traits: { tone: 3, output: 8, stagePresence: 2 } },
  { id: "elec-boutique", label: "Hand-wound Boutique", slot: "electronics", catalogNames: ["Hand-Wound Boutique Pickup"], requirement: req("mastery", 11), traits: { tone: 8, output: 6, stagePresence: 2 } },

  // Hardware
  { id: "hw-standard", label: "Standard Hardware", slot: "hardware", catalogNames: ["Bridge and Hardware Kit", "Standard Tuners Set"], requirement: req("basic", 0), traits: { stability: 1, sustain: 1 } },
  { id: "hw-locking", label: "Locking Hardware", slot: "hardware", catalogNames: ["Locking Tuners Set"], requirement: req("basic", 8), traits: { stability: 4, sustain: 1 } },
  { id: "hw-tom", label: "Fixed Bridge", slot: "hardware", catalogNames: ["Tune-O-Matic Bridge", "Bridge and Hardware Kit"], requirement: req("basic", 13), traits: { stability: 3, sustain: 4 } },
  { id: "hw-trem", label: "Tremolo", slot: "hardware", catalogNames: ["Tremolo Bridge"], requirement: req("professional", 3), traits: { stability: 1, sustain: 2, stagePresence: 3 } },
  { id: "hw-floyd", label: "Double-locking Tremolo", slot: "hardware", catalogNames: ["Floyd Rose Tremolo"], requirement: req("professional", 11), traits: { stability: 6, sustain: 2, stagePresence: 5 } },
  { id: "hw-gold", label: "Gold Hardware", slot: "hardware", catalogNames: ["Gold Hardware Set"], requirement: req("mastery", 8), traits: { stability: 4, sustain: 3, stagePresence: 8 } },

  // Finish
  { id: "finish-satin", label: "Satin Lacquer", slot: "finish", catalogNames: ["Satin Lacquer"], requirement: req("basic", 0), traits: { stagePresence: 0 } },
  { id: "finish-gloss", label: "Gloss Nitrocellulose", slot: "finish", catalogNames: ["Gloss Nitrocellulose"], requirement: req("basic", 8), traits: { stagePresence: 2 } },
  { id: "finish-burst", label: "Burst Sunburst", slot: "finish", catalogNames: ["Burst Sunburst Finish"], requirement: req("professional", 5), traits: { stagePresence: 4 } },
  { id: "finish-metalflake", label: "Metallic Flake", slot: "finish", catalogNames: ["Metallic Flake Finish"], requirement: req("professional", 9), traits: { stagePresence: 7 } },
  { id: "finish-artwork", label: "Custom Artwork", slot: "finish", catalogNames: ["Custom Artwork Finish"], requirement: req("mastery", 11), traits: { stagePresence: 10 } },
];

// Construction variants consume the same stock and preserve their base option’s skill/stat rules.
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "body-alder"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "body-chambered-alder", label: "Chambered Alder" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "body-mahogany"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "body-carved-mahogany", label: "Carved Mahogany" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "neck-maple"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "neck-slim-maple", label: "Slim C Maple" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "neck-mahogany"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "neck-chunky-mahogany", label: "Rounded C Mahogany" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "fret-rosewood"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "fret-rosewood-block", label: "Rosewood / Block Inlays" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "fret-ebony"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "fret-ebony-clean", label: "Ebony / No Inlays" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "elec-single"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "elec-p90", label: "P-90 Soapbar" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "elec-single"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "elec-jazz", label: "Vintage Twin Single Coils" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "hw-locking"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "hw-black", label: "Black Locking Hardware" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "hw-tom"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "hw-aged", label: "Aged Nickel Fixed Bridge" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "finish-satin"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "finish-worn", label: "Worn Satin" }); }
{ const base = LUTHIERY_MATERIAL_OPTIONS.find(option => option.id === "finish-gloss"); if (base) LUTHIERY_MATERIAL_OPTIONS.push({ ...base, id: "finish-natural", label: "Natural Clear Gloss" }); }

export const DEFAULT_LUTHIERY_SELECTION: LuthieryBuildSelection = {
  instrumentName: "",
  instrumentKind: "electric_guitar",
  shapeId: "double-cut",
  colour: "#141821",
  finishId: "finish-satin",
  decal: {
    id: "none",
    x: 50,
    y: 50,
    scale: 100,
    rotation: 0,
    colour: "#f5f5f5",
  },
  parts: {
    body: "body-alder",
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
  if (values.mastery > 0) return clamp(80 + (values.mastery / MAX_SKILL_LEVEL) * 20);
  if (values.professional > 0) return clamp(55 + (values.professional / MAX_SKILL_LEVEL) * 25);
  return clamp(10 + (values.basic / MAX_SKILL_LEVEL) * 45);
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


export const LUTHIERY_INSTRUMENT_NAME_MAX_LENGTH = 40;

export function normalizeLuthieryInstrumentName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, LUTHIERY_INSTRUMENT_NAME_MAX_LENGTH);
}

export function validateLuthieryInstrumentName(value: string): string | null {
  const normalized = normalizeLuthieryInstrumentName(value);
  if (!normalized) return "Name your instrument before confirming the design.";
  if (normalized.length < 2) return "Instrument name must be at least 2 characters.";
  return null;
}

export function getLuthieryBuildRequirements(
  selection: LuthieryBuildSelection,
  catalog: CraftingMaterial[],
): { requirements: LuthieryBuildRequirement[]; missingCatalogOptions: string[] } {
  const options = [
    ...LUTHIERY_PART_ORDER.map((slot) => getMaterialOption(selection.parts[slot])),
    getMaterialOption(selection.finishId),
  ].filter((option): option is LuthieryMaterialOption => Boolean(option));

  const byMaterial = new Map<string, LuthieryBuildRequirement>();
  const missingCatalogOptions: string[] = [];

  for (const option of options) {
    const material = resolveCatalogMaterial(option, catalog);
    if (!material) {
      missingCatalogOptions.push(option.label);
      continue;
    }
    const existing = byMaterial.get(material.id);
    const source = option.slot === "finish" ? "Finish" : LUTHIERY_PART_LABELS[option.slot];
    if (existing) {
      existing.quantity += 1;
      existing.sources.push(source);
    } else {
      byMaterial.set(material.id, { material, quantity: 1, sources: [source] });
    }
  }

  return { requirements: [...byMaterial.values()], missingCatalogOptions };
}

export function getLuthieryBuildReadiness(
  selection: LuthieryBuildSelection,
  catalog: CraftingMaterial[],
  playerMaterials: PlayerCraftingMaterial[],
  progress: SkillProgressRecord[],
): LuthieryBuildReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const nameError = validateLuthieryInstrumentName(selection.instrumentName);
  if (nameError) blockers.push(nameError);

  const shape = getShapeForSelection(selection);
  if (shape.id !== selection.shapeId) blockers.push("Choose a body shape supported by this instrument type.");
  if (!isLuthieryRequirementMet(shape.requirement, progress)) {
    blockers.push(`Body shape requires ${formatLuthieryRequirement(shape.requirement)}.`);
  }

  for (const slot of LUTHIERY_PART_ORDER) {
    const option = getMaterialOption(selection.parts[slot]);
    if (!option || option.slot !== slot) {
      blockers.push(`Choose a valid ${LUTHIERY_PART_LABELS[slot].toLowerCase()} material.`);
      continue;
    }
    if (!isLuthieryRequirementMet(option.requirement, progress)) {
      blockers.push(`${option.label} requires ${formatLuthieryRequirement(option.requirement)}.`);
    }
  }

  const finish = getMaterialOption(selection.finishId);
  if (!finish || finish.slot !== "finish") {
    blockers.push("Choose a valid finish.");
  } else if (!isLuthieryRequirementMet(finish.requirement, progress)) {
    blockers.push(`${finish.label} requires ${formatLuthieryRequirement(finish.requirement)}.`);
  }

  if (selection.decal.id !== "none" && selection.finishId !== "finish-artwork") {
    blockers.push("Choose Custom Artwork finish before placing a decal.");
  }

  const { requirements, missingCatalogOptions } = getLuthieryBuildRequirements(selection, catalog);
  for (const option of missingCatalogOptions) blockers.push(`${option} is not stocked in the crafting catalogue.`);

  for (const requirement of requirements) {
    const owned = playerMaterials.find((item) => item.material_id === requirement.material.id)?.quantity ?? 0;
    if (owned < requirement.quantity) {
      blockers.push(
        `Need ${requirement.quantity} × ${requirement.material.name}; you own ${owned}.`,
      );
    }
  }

  if (selection.decal.id === "none" && selection.finishId === "finish-artwork") {
    warnings.push("Custom Artwork finish is selected without a decal.");
  }

  return { ready: blockers.length === 0, blockers, warnings, requirements };
}

export function createLuthieryBuildPreviewSpec(
  selection: LuthieryBuildSelection,
  catalog: CraftingMaterial[],
  progress: SkillProgressRecord[],
): LuthieryBuildPreviewSpec {
  const shape = getShapeForSelection(selection);
  const finish = getMaterialOption(selection.finishId);
  const outcome = calculateProjectedLuthieryOutcome(selection, catalog, progress);

  const parts = Object.fromEntries(
    LUTHIERY_PART_ORDER.map((slot) => {
      const option = getMaterialOption(selection.parts[slot]);
      const material = option ? resolveCatalogMaterial(option, catalog) : undefined;
      return [
        slot,
        {
          optionId: option?.id ?? selection.parts[slot],
          label: option?.label ?? "Unknown",
          materialId: material?.id ?? null,
          materialName: material?.name ?? null,
        },
      ];
    }),
  ) as LuthieryBuildPreviewSpec["parts"];

  return {
    instrumentName: normalizeLuthieryInstrumentName(selection.instrumentName),
    instrumentKind: selection.instrumentKind,
    shapeId: shape.id,
    shapeName: shape.name,
    colour: selection.colour,
    finishId: finish?.id ?? selection.finishId,
    finishName: finish?.label ?? "Unknown",
    decal: { ...selection.decal },
    parts,
    projectedQuality: outcome.quality,
    projectedStats: { ...outcome.stats },
  };
}
