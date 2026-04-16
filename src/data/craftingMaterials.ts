// Seed data constants for crafting materials and starter recipes

export interface CraftingMaterialSeed {
  name: string;
  category: "wood" | "electronics" | "hardware" | "strings" | "finish" | "pedal_components" | "amp_components";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  quality_tier: number;
  base_cost: number;
  description: string;
}

export interface CraftingRecipeSeed {
  name: string;
  result_category: string;
  result_subcategory: string | null;
  required_skill_slug: string;
  min_skill_level: number;
  materials_required: { material_name: string; quantity: number }[];
  base_craft_time_minutes: number;
  difficulty_tier: number;
  rarity_output: string;
  description: string;
}

export const CRAFTING_MATERIALS: CraftingMaterialSeed[] = [
  // Wood
  { name: "Pine Body Blank", category: "wood", rarity: "common", quality_tier: 1, base_cost: 50, description: "Soft, lightweight tonewood — great for beginners." },
  { name: "Poplar Body Blank", category: "wood", rarity: "common", quality_tier: 1, base_cost: 60, description: "Neutral tone, easy to work with." },
  { name: "Alder Body Blank", category: "wood", rarity: "uncommon", quality_tier: 2, base_cost: 120, description: "Balanced, versatile tonewood used in many classic guitars." },
  { name: "Ash Body Blank", category: "wood", rarity: "uncommon", quality_tier: 2, base_cost: 140, description: "Bright, resonant wood with beautiful grain." },
  { name: "Mahogany Body Blank", category: "wood", rarity: "rare", quality_tier: 3, base_cost: 250, description: "Warm, rich tonewood favored for its depth." },
  { name: "Maple Neck Blank", category: "wood", rarity: "uncommon", quality_tier: 2, base_cost: 100, description: "Dense, bright wood ideal for necks and fretboards." },
  { name: "Rosewood Fretboard", category: "wood", rarity: "rare", quality_tier: 3, base_cost: 180, description: "Dark, warm fretboard wood with smooth feel." },
  { name: "Ebony Fretboard", category: "wood", rarity: "epic", quality_tier: 4, base_cost: 350, description: "Ultra-dense, jet-black fretboard for premium instruments." },
  { name: "Spruce Top Plate", category: "wood", rarity: "uncommon", quality_tier: 2, base_cost: 130, description: "Light, responsive top wood for acoustic instruments." },
  { name: "Korina Body Blank", category: "wood", rarity: "epic", quality_tier: 4, base_cost: 400, description: "Rare African wood with legendary tone." },
  { name: "Brazilian Rosewood Set", category: "wood", rarity: "legendary", quality_tier: 5, base_cost: 1200, description: "The holy grail of tonewoods — extremely rare and coveted." },

  // Electronics
  { name: "Single Coil Pickup", category: "electronics", rarity: "common", quality_tier: 1, base_cost: 40, description: "Bright, twangy pickup for clean tones." },
  { name: "Humbucker Pickup", category: "electronics", rarity: "common", quality_tier: 1, base_cost: 55, description: "Warm, thick pickup that cancels hum." },
  { name: "Alnico V Pickup", category: "electronics", rarity: "uncommon", quality_tier: 2, base_cost: 120, description: "Hot alnico magnet pickup with strong output." },
  { name: "PAF Clone Pickup", category: "electronics", rarity: "rare", quality_tier: 3, base_cost: 200, description: "Vintage-voiced pickup replicating the legendary PAF tone." },
  { name: "Active EMG Pickup", category: "electronics", rarity: "rare", quality_tier: 3, base_cost: 220, description: "Battery-powered pickup with high output and clarity." },
  { name: "Hand-Wound Boutique Pickup", category: "electronics", rarity: "epic", quality_tier: 4, base_cost: 450, description: "Artisan-crafted pickup with unique character." },
  { name: "Wiring Harness", category: "electronics", rarity: "common", quality_tier: 1, base_cost: 25, description: "Pots, caps, and wiring for guitar electronics." },

  // Hardware
  { name: "Standard Tuners Set", category: "hardware", rarity: "common", quality_tier: 1, base_cost: 30, description: "Basic sealed tuning machines." },
  { name: "Locking Tuners Set", category: "hardware", rarity: "uncommon", quality_tier: 2, base_cost: 80, description: "Quick-change tuners that lock strings in place." },
  { name: "Tremolo Bridge", category: "hardware", rarity: "uncommon", quality_tier: 2, base_cost: 90, description: "Vibrato bridge for pitch bending effects." },
  { name: "Tune-O-Matic Bridge", category: "hardware", rarity: "common", quality_tier: 1, base_cost: 45, description: "Adjustable bridge for precise intonation." },
  { name: "Floyd Rose Tremolo", category: "hardware", rarity: "rare", quality_tier: 3, base_cost: 250, description: "Double-locking tremolo for extreme dive bombs." },
  { name: "Brass Nut", category: "hardware", rarity: "uncommon", quality_tier: 2, base_cost: 35, description: "Dense nut material for bright sustain." },
  { name: "Bone Nut", category: "hardware", rarity: "rare", quality_tier: 3, base_cost: 60, description: "Natural bone nut for warm, balanced tone." },
  { name: "Gold Hardware Set", category: "hardware", rarity: "epic", quality_tier: 4, base_cost: 300, description: "Premium gold-plated knobs, pickup rings, and jack plate." },

  // Strings
  { name: "Nickel Wound Strings", category: "strings", rarity: "common", quality_tier: 1, base_cost: 10, description: "Standard electric guitar strings." },
  { name: "Phosphor Bronze Strings", category: "strings", rarity: "common", quality_tier: 1, base_cost: 12, description: "Warm acoustic guitar strings." },
  { name: "Flatwound Strings", category: "strings", rarity: "uncommon", quality_tier: 2, base_cost: 25, description: "Smooth, jazzy feel with reduced finger noise." },
  { name: "Coated Strings", category: "strings", rarity: "uncommon", quality_tier: 2, base_cost: 20, description: "Long-lasting strings with polymer coating." },

  // Finish
  { name: "Satin Lacquer", category: "finish", rarity: "common", quality_tier: 1, base_cost: 30, description: "Smooth matte finish that feels natural." },
  { name: "Gloss Nitrocellulose", category: "finish", rarity: "uncommon", quality_tier: 2, base_cost: 80, description: "Classic finish that ages beautifully over time." },
  { name: "Burst Sunburst Finish", category: "finish", rarity: "rare", quality_tier: 3, base_cost: 150, description: "Iconic gradient finish from amber to black." },
  { name: "Metallic Flake Finish", category: "finish", rarity: "rare", quality_tier: 3, base_cost: 180, description: "Eye-catching sparkle finish for stage presence." },
  { name: "Custom Artwork Finish", category: "finish", rarity: "epic", quality_tier: 4, base_cost: 500, description: "Hand-painted custom artwork by a master luthier." },
];

export const CRAFTING_RECIPES: CraftingRecipeSeed[] = [
  {
    name: "Basic Electric Guitar",
    result_category: "guitar",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_basic_technical",
    min_skill_level: 1,
    materials_required: [
      { material_name: "Pine Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Single Coil Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Standard Tuners Set", quantity: 1 },
      { material_name: "Tune-O-Matic Bridge", quantity: 1 },
      { material_name: "Nickel Wound Strings", quantity: 1 },
      { material_name: "Satin Lacquer", quantity: 1 },
    ],
    base_craft_time_minutes: 60,
    difficulty_tier: 1,
    rarity_output: "common",
    description: "A simple solid-body electric guitar. A great first project.",
  },
  {
    name: "Standard Electric Guitar",
    result_category: "guitar",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_basic_technical",
    min_skill_level: 3,
    materials_required: [
      { material_name: "Alder Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Rosewood Fretboard", quantity: 1 },
      { material_name: "Alnico V Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Locking Tuners Set", quantity: 1 },
      { material_name: "Tremolo Bridge", quantity: 1 },
      { material_name: "Nickel Wound Strings", quantity: 1 },
      { material_name: "Gloss Nitrocellulose", quantity: 1 },
    ],
    base_craft_time_minutes: 120,
    difficulty_tier: 2,
    rarity_output: "uncommon",
    description: "A well-crafted electric guitar with quality components.",
  },
  {
    name: "Premium Les Paul Style",
    result_category: "guitar",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_professional_technical",
    min_skill_level: 5,
    materials_required: [
      { material_name: "Mahogany Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Ebony Fretboard", quantity: 1 },
      { material_name: "PAF Clone Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Locking Tuners Set", quantity: 1 },
      { material_name: "Tune-O-Matic Bridge", quantity: 1 },
      { material_name: "Bone Nut", quantity: 1 },
      { material_name: "Nickel Wound Strings", quantity: 1 },
      { material_name: "Burst Sunburst Finish", quantity: 1 },
    ],
    base_craft_time_minutes: 180,
    difficulty_tier: 3,
    rarity_output: "rare",
    description: "A premium dual-humbucker guitar with classic styling.",
  },
  {
    name: "Shred Machine",
    result_category: "guitar",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_professional_technical",
    min_skill_level: 7,
    materials_required: [
      { material_name: "Ash Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Ebony Fretboard", quantity: 1 },
      { material_name: "Active EMG Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Locking Tuners Set", quantity: 1 },
      { material_name: "Floyd Rose Tremolo", quantity: 1 },
      { material_name: "Nickel Wound Strings", quantity: 1 },
      { material_name: "Metallic Flake Finish", quantity: 1 },
    ],
    base_craft_time_minutes: 200,
    difficulty_tier: 4,
    rarity_output: "epic",
    description: "A high-performance shred guitar with Floyd Rose and active pickups.",
  },
  {
    name: "Masterwork Custom Guitar",
    result_category: "guitar",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_mastery_technical",
    min_skill_level: 10,
    materials_required: [
      { material_name: "Korina Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Ebony Fretboard", quantity: 1 },
      { material_name: "Hand-Wound Boutique Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Locking Tuners Set", quantity: 1 },
      { material_name: "Tune-O-Matic Bridge", quantity: 1 },
      { material_name: "Bone Nut", quantity: 1 },
      { material_name: "Gold Hardware Set", quantity: 1 },
      { material_name: "Nickel Wound Strings", quantity: 1 },
      { material_name: "Custom Artwork Finish", quantity: 1 },
    ],
    base_craft_time_minutes: 240,
    difficulty_tier: 5,
    rarity_output: "legendary",
    description: "A one-of-a-kind masterpiece built with the finest materials.",
  },
  {
    name: "Basic Acoustic Guitar",
    result_category: "guitar",
    result_subcategory: "acoustic",
    required_skill_slug: "luthiery_basic_technical",
    min_skill_level: 2,
    materials_required: [
      { material_name: "Spruce Top Plate", quantity: 1 },
      { material_name: "Mahogany Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Rosewood Fretboard", quantity: 1 },
      { material_name: "Standard Tuners Set", quantity: 1 },
      { material_name: "Bone Nut", quantity: 1 },
      { material_name: "Phosphor Bronze Strings", quantity: 1 },
      { material_name: "Satin Lacquer", quantity: 1 },
    ],
    base_craft_time_minutes: 150,
    difficulty_tier: 2,
    rarity_output: "uncommon",
    description: "A warm, resonant acoustic guitar.",
  },
  {
    name: "Basic Bass Guitar",
    result_category: "bass",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_basic_technical",
    min_skill_level: 2,
    materials_required: [
      { material_name: "Alder Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Rosewood Fretboard", quantity: 1 },
      { material_name: "Single Coil Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Standard Tuners Set", quantity: 1 },
      { material_name: "Tune-O-Matic Bridge", quantity: 1 },
      { material_name: "Nickel Wound Strings", quantity: 1 },
      { material_name: "Satin Lacquer", quantity: 1 },
    ],
    base_craft_time_minutes: 90,
    difficulty_tier: 2,
    rarity_output: "uncommon",
    description: "A solid 4-string bass guitar.",
  },
  {
    name: "Premium Jazz Bass",
    result_category: "bass",
    result_subcategory: "electric",
    required_skill_slug: "luthiery_professional_technical",
    min_skill_level: 6,
    materials_required: [
      { material_name: "Ash Body Blank", quantity: 1 },
      { material_name: "Maple Neck Blank", quantity: 1 },
      { material_name: "Ebony Fretboard", quantity: 1 },
      { material_name: "Alnico V Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
      { material_name: "Locking Tuners Set", quantity: 1 },
      { material_name: "Brass Nut", quantity: 1 },
      { material_name: "Flatwound Strings", quantity: 1 },
      { material_name: "Gloss Nitrocellulose", quantity: 1 },
    ],
    base_craft_time_minutes: 160,
    difficulty_tier: 3,
    rarity_output: "rare",
    description: "A smooth jazz bass with flatwound strings and boutique pickups.",
  },
  {
    name: "Cable Set",
    result_category: "accessories",
    result_subcategory: "cables",
    required_skill_slug: "luthiery_basic_technical",
    min_skill_level: 1,
    materials_required: [
      { material_name: "Wiring Harness", quantity: 2 },
    ],
    base_craft_time_minutes: 15,
    difficulty_tier: 1,
    rarity_output: "common",
    description: "A set of quality instrument cables.",
  },
  {
    name: "Pickup Upgrade Kit",
    result_category: "accessories",
    result_subcategory: "electronics",
    required_skill_slug: "luthiery_basic_technical",
    min_skill_level: 3,
    materials_required: [
      { material_name: "Humbucker Pickup", quantity: 2 },
      { material_name: "Wiring Harness", quantity: 1 },
    ],
    base_craft_time_minutes: 30,
    difficulty_tier: 1,
    rarity_output: "common",
    description: "A drop-in humbucker upgrade for any guitar.",
  },
];

export const QUALITY_LABELS: Record<string, { label: string; color: string; minRoll: number }> = {
  flawed: { label: "Flawed", color: "text-red-400", minRoll: 0 },
  standard: { label: "Standard", color: "text-muted-foreground", minRoll: 20 },
  quality: { label: "Quality", color: "text-blue-400", minRoll: 40 },
  superior: { label: "Superior", color: "text-purple-400", minRoll: 60 },
  excellent: { label: "Excellent", color: "text-yellow-400", minRoll: 80 },
  masterwork: { label: "Masterwork", color: "text-amber-300", minRoll: 95 },
};

export const getQualityLabel = (roll: number) => {
  if (roll >= 95) return QUALITY_LABELS.masterwork;
  if (roll >= 80) return QUALITY_LABELS.excellent;
  if (roll >= 60) return QUALITY_LABELS.superior;
  if (roll >= 40) return QUALITY_LABELS.quality;
  if (roll >= 20) return QUALITY_LABELS.standard;
  return QUALITY_LABELS.flawed;
};
