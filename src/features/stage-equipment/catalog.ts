export type StageEquipmentType =
  | "Sound"
  | "Lighting"
  | "Visuals"
  | "Effects"
  | "Decor"
  | "Transport"
  | "Utility";

export type WeightCategory = "light" | "medium" | "heavy" | "very_heavy";
export type SizeCategory = "tiny" | "small" | "medium" | "larger" | "huge";
export type ConditionTier =
  | "almost_dead"
  | "terrible"
  | "bad"
  | "usable"
  | "ok"
  | "good"
  | "very_good"
  | "brand_new";
export type RarityTier =
  | "common"
  | "normal"
  | "rare"
  | "ultra_rare"
  | "super_ultra_rare"
  | "wow_you_cant_find_these_anywhere";

export interface EquipmentCatalogItem {
  id: string;
  name: string;
  type: StageEquipmentType;
  cost: number;
  liveImpact: string;
  weight: WeightCategory;
  size: SizeCategory;
  baseCondition: ConditionTier;
  amountAvailable: number;
  rarity: RarityTier;
  description?: string;
}

export interface AdminEquipmentFormValues {
  name: string;
  type: StageEquipmentType;
  cost: number;
  liveImpact: string;
  weight: WeightCategory;
  size: SizeCategory;
  condition: ConditionTier;
  amountAvailable: number;
  rarity: RarityTier;
  description?: string;
}

export const EQUIPMENT_TYPES: StageEquipmentType[] = [
  "Sound",
  "Lighting",
  "Visuals",
  "Effects",
  "Decor",
  "Transport",
  "Utility",
];

export const CONDITION_ORDER: ConditionTier[] = [
  "almost_dead",
  "terrible",
  "bad",
  "usable",
  "ok",
  "good",
  "very_good",
  "brand_new",
];

export const WEIGHT_OPTIONS: WeightCategory[] = ["light", "medium", "heavy", "very_heavy"];
export const SIZE_OPTIONS: SizeCategory[] = ["tiny", "small", "medium", "larger", "huge"];
export const RARITY_OPTIONS: RarityTier[] = [
  "common",
  "normal",
  "rare",
  "ultra_rare",
  "super_ultra_rare",
  "wow_you_cant_find_these_anywhere",
];

export const ADMIN_FORM_DEFAULTS: AdminEquipmentFormValues = {
  name: "",
  type: "Sound",
  cost: 1000,
  liveImpact: "Improves live presence",
  weight: "medium",
  size: "medium",
  condition: "good",
  amountAvailable: 1,
  rarity: "normal",
  description: "",
};

const CATALOG_TEMPLATE: ReadonlyArray<EquipmentCatalogItem> = [
  {
    id: "sound-elite-array",
    name: "Elite Line Array System",
    type: "Sound",
    cost: 18500,
    liveImpact: "Arena-grade clarity with directional control for massive rooms.",
    weight: "very_heavy",
    size: "huge",
    baseCondition: "brand_new",
    amountAvailable: 2,
    rarity: "rare",
    description: "Engineered for headline stages that demand pristine dispersion across festival fields.",
  },
  {
    id: "lighting-halo",
    name: "Halo Beam Matrix",
    type: "Lighting",
    cost: 7600,
    liveImpact: "Programmable pan/tilt beams with synchronized pixel waves.",
    weight: "medium",
    size: "larger",
    baseCondition: "very_good",
    amountAvailable: 4,
    rarity: "ultra_rare",
    description: "Ride dramatic sweeps and aerial bursts that punctuate breakdowns and finales.",
  },
  {
    id: "visuals-vortex",
    name: "Vortex LED Wall",
    type: "Visuals",
    cost: 9200,
    liveImpact: "High-density LED mesh for reactive backdrops and dynamic storytelling.",
    weight: "heavy",
    size: "huge",
    baseCondition: "good",
    amountAvailable: 3,
    rarity: "super_ultra_rare",
    description: "Transforms every venue into a cinematic canvas tied to your setlist cues.",
  },
  {
    id: "effects-thunder",
    name: "Thunderstrike FX Rack",
    type: "Effects",
    cost: 5400,
    liveImpact: "Modular CO₂ jets and spark fountains for high-impact drops.",
    weight: "medium",
    size: "medium",
    baseCondition: "very_good",
    amountAvailable: 5,
    rarity: "rare",
    description: "CO₂, sparks, and cold sparks rigged for synchronized hits during breakdowns.",
  },
  {
    id: "decor-celestial",
    name: "Celestial Stage Atmospherics",
    type: "Decor",
    cost: 2600,
    liveImpact: "Transforms intimate rooms with layered scenic textures and depth.",
    weight: "light",
    size: "medium",
    baseCondition: "good",
    amountAvailable: 7,
    rarity: "normal",
    description: "Modular scenic elements with fog-integrated lighting and cosmic projections.",
  },
  {
    id: "transport-grid",
    name: "Tour Grid Locker System",
    type: "Transport",
    cost: 4200,
    liveImpact: "Speeds load-ins with precision-labeled compartments and staging flow.",
    weight: "heavy",
    size: "larger",
    baseCondition: "ok",
    amountAvailable: 6,
    rarity: "normal",
    description: "Road-tested locker system ensuring zero-miss loadouts under festival time crunches.",
  },
  {
    id: "utility-battery",
    name: "Phoenix Power Battery Wall",
    type: "Utility",
    cost: 8800,
    liveImpact: "Silent power redundancy that keeps the show live during brownouts.",
    weight: "very_heavy",
    size: "huge",
    baseCondition: "very_good",
    amountAvailable: 2,
    rarity: "rare",
    description: "Modular battery arrays with smart routing to protect sensitive rigs mid-set.",
  },
];

export const createInitialStageEquipmentCatalog = (): EquipmentCatalogItem[] =>
  CATALOG_TEMPLATE.map((item) => ({ ...item }));

export const generateEquipmentCatalogId = () => `catalog-${Math.random().toString(36).slice(2, 10)}`;

export const equipmentLabelMap: Record<
  ConditionTier | WeightCategory | SizeCategory | RarityTier,
  string
> = {
  almost_dead: "Almost Dead",
  terrible: "Terrible",
  bad: "Bad",
  usable: "Usable",
  ok: "Ok",
  good: "Good",
  very_good: "Very Good",
  brand_new: "Brand New",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  very_heavy: "Very Heavy",
  tiny: "Tiny",
  small: "Small",
  larger: "Larger",
  huge: "Huge",
  common: "Common",
  normal: "Normal",
  rare: "Rare",
  ultra_rare: "Ultra Rare",
  super_ultra_rare: "Super Ultra Rare",
  wow_you_cant_find_these_anywhere: "Wow you can't find these anywhere",
};

export const formatEquipmentCurrency = (value?: number | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
