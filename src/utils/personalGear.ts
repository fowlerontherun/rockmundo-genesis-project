export const PERSONAL_GEAR_RARITY_BONUS: Record<string, number> = {
  common: 5,
  uncommon: 10,
  rare: 18,
  epic: 25,
  legendary: 35,
};

const normalizeEquipmentKey = (value: string | null | undefined) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const MICROPHONE_SUBCATEGORIES = new Set([
  "microphone",
  "dynamic_mic",
  "condenser_mic",
  "condenser",
  "ribbon_mic",
  "tube_mic",
  "wireless_mic",
]);

const GUITAR_EFFECT_SUBCATEGORIES = new Set([
  "overdrive",
  "distortion",
  "fuzz",
  "delay",
  "reverb",
  "chorus",
  "flanger",
  "phaser",
  "tremolo",
  "vibe",
  "compressor",
  "noise_gate",
  "tuner",
  "wah",
  "volume",
  "pitch",
  "octave",
  "modulation",
  "multi",
]);

/**
 * Canonical equipment type used by role-fit and performance scoring.
 *
 * The game has equipment data from multiple generations, so equivalent items
 * can arrive as e.g. instrument/acoustic_guitar or guitar/acoustic. Resolve
 * those aliases here instead of relying on substring matching.
 */
export function getCanonicalEquipmentType(
  category: string | null | undefined,
  subcategory: string | null | undefined,
): string | null {
  const cat = normalizeEquipmentKey(category);
  const sub = normalizeEquipmentKey(subcategory);

  if (!cat && !sub) return null;

  if (cat === "instrument") {
    if (["guitar", "electric", "electric_guitar", "lead_guitar"].includes(sub)) return "electric_guitar";
    if (["acoustic", "acoustic_guitar", "12_string_guitar", "dobro", "resonator"].includes(sub)) return "acoustic_guitar";
    if (["classical", "classical_guitar", "nylon_string_guitar"].includes(sub)) return "classical_guitar";
    if (["bass", "bass_guitar", "upright_bass"].includes(sub)) return sub === "upright_bass" ? "upright_bass" : "bass_guitar";
    if (["drums", "drum_kit", "kit"].includes(sub)) return "drums";
    if (sub === "electronic_drums") return "electronic_drums";
    if (sub === "cymbals") return "cymbals";
    if (["keyboard", "piano", "classical_piano", "jazz_piano", "rhodes", "wurlitzer"].includes(sub)) return "keyboard";
    if (["synth", "synthesizer", "analog_synth", "digital_synth", "eurorack"].includes(sub)) return "synthesizer";
    if (sub === "midi_controller") return "midi_controller";
    return sub || null;
  }

  // Historical equipment_items rows used the instrument family as category.
  if (cat === "guitar") {
    if (["acoustic", "acoustic_guitar", "12_string_guitar"].includes(sub)) return "acoustic_guitar";
    if (["classical", "classical_guitar", "nylon_string_guitar"].includes(sub)) return "classical_guitar";
    if (["bass", "bass_guitar", "upright_bass"].includes(sub)) return sub === "upright_bass" ? "upright_bass" : "bass_guitar";
    return "electric_guitar";
  }
  if (cat === "bass") return sub === "upright_bass" ? "upright_bass" : "bass_guitar";
  if (cat === "drums") return sub === "electronic_drums" ? "electronic_drums" : sub === "cymbals" ? "cymbals" : "drums";
  if (cat === "microphone" || cat === "vocal") return "microphone";
  if (cat === "keyboard" || cat === "piano") return "keyboard";
  if (cat === "synth" || cat === "synthesizer") return "synthesizer";

  if (cat === "recording") {
    if (MICROPHONE_SUBCATEGORIES.has(sub)) return "microphone";
    if (["audio_interface", "interface"].includes(sub)) return "audio_interface";
    return sub || "recording";
  }

  if (cat === "amplifier") {
    if (sub === "bass_amp") return "bass_amp";
    if (["guitar_amp", "tube_combo", "tube_head", "modeler"].includes(sub)) return "guitar_amp";
    return sub || "amplifier";
  }

  if (cat === "effects") {
    return GUITAR_EFFECT_SUBCATEGORIES.has(sub) ? "guitar_effect" : sub || "effects";
  }

  if (cat === "stage") {
    if (sub === "wireless_mic") return "microphone";
    if (sub === "wireless_guitar") return "wireless_guitar";
    return sub || "stage";
  }

  // Preserve future/legacy instrument-family categories so exact role aliases
  // (saxophone, trumpet, violin, etc.) can still be matched safely.
  return sub || cat || null;
}

const ROLE_GEAR_TYPES: Record<string, string[]> = {
  "Lead Guitar": ["electric_guitar", "guitar_amp", "guitar_effect", "wireless_guitar"],
  "Rhythm Guitar": ["electric_guitar", "acoustic_guitar", "classical_guitar", "guitar_amp", "guitar_effect", "wireless_guitar"],
  "Acoustic Guitar": ["acoustic_guitar"],
  "Classical Guitar": ["classical_guitar"],
  "Electric Guitar": ["electric_guitar", "guitar_amp", "guitar_effect", "wireless_guitar"],
  Bass: ["bass_guitar", "upright_bass", "bass_amp", "wireless_guitar"],
  Drums: ["drums", "electronic_drums", "cymbals"],
  Vocals: ["microphone"],
  "Lead Vocals": ["microphone"],
  Keys: ["keyboard", "midi_controller"],
  Keyboard: ["keyboard", "synthesizer", "midi_controller"],
  Synth: ["synthesizer", "keyboard", "midi_controller"],
  DJ: ["dj", "controller", "turntablism", "mpc"],
  Saxophone: ["wind", "saxophone", "alto_sax", "tenor_sax", "soprano_sax", "bari_sax"],
  Trumpet: ["brass", "trumpet"],
  Trombone: ["brass", "trombone"],
  Violin: ["strings", "violin"],
  Cello: ["strings", "cello"],
  Percussion: ["percussion", "latin_percussion", "african_drums", "cajon", "tabla"],
};

const resolveRoleKey = (role: string): string | null => {
  const normalized = role.trim().toLowerCase();

  const orderedAliases: Array<[RegExp, string]> = [
    [/\blead guitar\b/, "Lead Guitar"],
    [/\brhythm guitar\b/, "Rhythm Guitar"],
    [/\bacoustic guitar\b/, "Acoustic Guitar"],
    [/\bclassical guitar\b/, "Classical Guitar"],
    [/\belectric guitar\b/, "Electric Guitar"],
    [/\bbass( guitar|ist)?\b/, "Bass"],
    [/\b(drums?|drummer)\b/, "Drums"],
    [/\b(lead vocals?|lead singer|frontperson)\b/, "Lead Vocals"],
    [/\b(vocals?|vocalist|singer)\b/, "Vocals"],
    [/\b(synth|synthesizer)\b/, "Synth"],
    [/\b(keyboard|keyboardist)\b/, "Keyboard"],
    [/\b(keys|piano|pianist)\b/, "Keys"],
    [/\b(dj|turntablist)\b/, "DJ"],
    [/\b(sax|saxophone)\b/, "Saxophone"],
    [/\btrumpet\b/, "Trumpet"],
    [/\btrombone\b/, "Trombone"],
    [/\bviolin\b/, "Violin"],
    [/\bcello\b/, "Cello"],
    [/\bpercussion\b/, "Percussion"],
  ];

  return orderedAliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
};

export interface PersonalGearItemLike {
  category?: string | null;
  subcategory?: string | null;
  rarity?: string | null;
  stat_boosts?: Record<string, unknown> | null;
}

const LUTHIERY_PERFORMANCE_KEYS = [
  "luthiery_tone",
  "luthiery_sustain",
  "luthiery_stability",
  "luthiery_output",
  "luthiery_stage_presence",
] as const;

/**
 * Crafted Luthiery stats are absolute 0-100 craft characteristics, not direct
 * percentage modifiers. Convert their average to a small, bounded role bonus
 * so they matter without being counted again in the shared-equipment score.
 */
export function getLuthieryPerformanceBonusPercent(
  boosts: Record<string, unknown> | null | undefined,
): number {
  if (!boosts) return 0;
  const values = LUTHIERY_PERFORMANCE_KEYS
    .map((key) => Number(boosts[key]))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, Math.min(100, value)));
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.max(0, Math.min(8, Math.round(average / 12.5)));
}

export function personalGearMatchesRole(
  category: string | null | undefined,
  subcategory: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!role) return false;

  const roleKey = ROLE_GEAR_TYPES[role] ? role : resolveRoleKey(role);
  if (!roleKey) return false;

  const equipmentType = getCanonicalEquipmentType(category, subcategory);
  if (!equipmentType) return false;

  return ROLE_GEAR_TYPES[roleKey]?.includes(equipmentType) ?? false;
}

/**
 * Mirrors the per-item portion of process-gig-song's personal gear calculation.
 * The live scorer caps the combined equipped-gear bonus at +50%.
 */
export function getPersonalGearRoleBonusPercent(
  item: PersonalGearItemLike,
  role: string | null | undefined,
): number {
  if (!personalGearMatchesRole(item.category, item.subcategory, role)) return 0;

  const rarityBonus = PERSONAL_GEAR_RARITY_BONUS[(item.rarity || "common").toLowerCase()] ?? 5;
  const performance = Number(item.stat_boosts?.performance || 0);
  const craftedLuthieryBonus = normalizeEquipmentKey(item.subcategory) === "custom_luthiery"
    ? getLuthieryPerformanceBonusPercent(item.stat_boosts)
    : 0;
  return Math.max(
    0,
    Math.round(
      rarityBonus +
      (Number.isFinite(performance) ? performance : 0) +
      craftedLuthieryBonus,
    ),
  );
}

export function getPersonalGearFitLabel(
  item: PersonalGearItemLike,
  role: string | null | undefined,
): string {
  if (!role) return "Set a band role to see fit";
  return personalGearMatchesRole(item.category, item.subcategory, role)
    ? `Fits ${role}`
    : `Not used for ${role}`;
}
