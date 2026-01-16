import { getGenreSkillSlug } from "@/data/genres";

export interface SongQualityInputs {
  genre: string;
  skillLevels: Record<string, number>;
  attributes: {
    creative_insight: number;
    musical_ability: number;
    technical_mastery: number;
  };
  sessionHours: number;
  coWriters: number;
  aiLyrics: boolean;
}

export interface SongQualityResult {
  totalQuality: number;
  melodyStrength: number;
  lyricsStrength: number;
  rhythmStrength: number;
  arrangementStrength: number;
  productionPotential: number;
  genreMultiplier: number;
  skillCeiling: number;
  sessionLuckLabel: string;
  sessionLuckMultiplier: number;
}

// Session luck labels for display
const SESSION_LUCK_LABELS: Record<string, { min: number; max: number; label: string; emoji: string }> = {
  terrible: { min: 0.80, max: 0.85, label: "Terrible Day", emoji: "😰" },
  off: { min: 0.85, max: 0.90, label: "Off Day", emoji: "😐" },
  normal: { min: 0.90, max: 1.10, label: "Normal Session", emoji: "🎵" },
  inspired: { min: 1.10, max: 1.20, label: "Inspired!", emoji: "✨" },
  lightning: { min: 1.20, max: 1.30, label: "Lightning Strike!", emoji: "⚡" }
};

// Check if player can start songwriting - now always returns true
export function canStartSongwriting(skillLevels: Record<string, number>): boolean {
  return true;
}

// Check if player can write in a specific genre - now always returns true
export function canWriteGenre(genre: string, skillLevels: Record<string, number>): boolean {
  return true;
}

// Determine skill ceiling based on tier unlocks
export function getSkillCeiling(skillLevels: Record<string, number>): number {
  const hasMastery = (skillLevels['songwriting_mastery_composing_anthems'] || 0) >= 10 ||
                     (skillLevels['songwriting_mastery_lyrics'] || 0) >= 10 ||
                     (skillLevels['songwriting_mastery_record_production'] || 0) >= 10;
  
  const hasProfessional = (skillLevels['songwriting_professional_composing'] || 0) >= 10 ||
                          (skillLevels['songwriting_professional_lyrics'] || 0) >= 10 ||
                          (skillLevels['songwriting_professional_record_production'] || 0) >= 10;
  
  if (hasMastery) return 1000;
  if (hasProfessional) return 800;
  return 500;
}

// Session-wide luck factor - affects ALL components together
function getSessionLuck(): { multiplier: number; label: string; emoji: string } {
  const roll = Math.random();
  
  if (roll < 0.05) {
    // 5% - Terrible day (-15-20%)
    const multiplier = 0.80 + Math.random() * 0.05;
    return { multiplier, label: "Terrible Day", emoji: "😰" };
  }
  if (roll < 0.15) {
    // 10% - Off day (-10-15%)
    const multiplier = 0.85 + Math.random() * 0.05;
    return { multiplier, label: "Off Day", emoji: "😐" };
  }
  if (roll < 0.85) {
    // 70% - Normal (-5% to +5%)
    const multiplier = 0.95 + Math.random() * 0.10;
    return { multiplier, label: "Normal Session", emoji: "🎵" };
  }
  if (roll < 0.95) {
    // 10% - Inspired (+10-20%)
    const multiplier = 1.10 + Math.random() * 0.10;
    return { multiplier, label: "Inspired!", emoji: "✨" };
  }
  // 5% - Lightning strike (+20-30%)
  const multiplier = 1.20 + Math.random() * 0.10;
  return { multiplier, label: "Lightning Strike!", emoji: "⚡" };
}

// Calculate melody strength (0-280) - ENHANCED
function calculateMelodyStrength(
  skillLevels: Record<string, number>,
  musicalAbility: number
): number {
  const basicSkill = skillLevels['songwriting_basic_composing'] || 0;
  const proSkill = skillLevels['songwriting_professional_composing'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_composing_anthems'] || 0;
  
  // Tier-based scaling (each tier unlocks higher potential)
  const basicContribution = Math.min(60, basicSkill * 0.6);
  const proContribution = Math.min(70, proSkill * 0.9);
  const masteryContribution = Math.min(90, masterySkill * 1.1);
  
  // Skills can now contribute up to 220 (60+70+90)
  const skillBase = basicContribution + proContribution + masteryContribution;
  
  // Attribute bonus scaled higher (max 80)
  const attrBonus = Math.min(80, musicalAbility * 0.08);
  
  return skillBase + attrBonus;
}

// Calculate lyrics strength (0-280) - ENHANCED
function calculateLyricsStrength(
  skillLevels: Record<string, number>,
  creativeInsight: number,
  aiPenalty: boolean
): number {
  const basicSkill = skillLevels['songwriting_basic_lyrics'] || 0;
  const proSkill = skillLevels['songwriting_professional_lyrics'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_lyrics'] || 0;
  
  // More pronounced tier scaling
  const basicContribution = Math.min(50, basicSkill * 0.5);
  const proContribution = Math.min(80, proSkill * 1.0);
  const masteryContribution = Math.min(90, masterySkill * 1.1);
  
  const skillBase = basicContribution + proContribution + masteryContribution;
  const attrBonus = Math.min(80, creativeInsight * 0.08);
  
  const total = skillBase + attrBonus;
  return aiPenalty ? total * 0.85 : total; // Increase AI penalty to 15%
}

// Calculate rhythm strength (0-220)
function calculateRhythmStrength(skillLevels: Record<string, number>): number {
  const basicSkill = skillLevels['songwriting_basic_beatmaking'] || 0;
  const proSkill = skillLevels['songwriting_professional_beatmaking'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_beatmaking'] || 0;
  
  const basicContribution = Math.min(60, basicSkill * 0.6);
  const proContribution = Math.min(70, proSkill * 0.9);
  const masteryContribution = Math.min(90, masterySkill * 1.1);
  
  return basicContribution + proContribution + masteryContribution;
}

// Calculate arrangement strength (0-250) - ENHANCED
function calculateArrangementStrength(
  skillLevels: Record<string, number>,
  coWriters: number
): number {
  const basicSkill = skillLevels['songwriting_basic_record_production'] || 0;
  const proSkill = skillLevels['songwriting_professional_record_production'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_record_production'] || 0;
  
  const basicContribution = Math.min(50, basicSkill * 0.5);
  const proContribution = Math.min(70, proSkill * 0.9);
  const masteryContribution = Math.min(100, masterySkill * 1.2);
  
  const skillBase = basicContribution + proContribution + masteryContribution;
  
  // Collaboration bonus (max +30)
  const collabBonus = Math.min(30, coWriters * 7);
  
  return skillBase + collabBonus;
}

// Calculate production potential (0-280) - ENHANCED
function calculateProductionPotential(
  skillLevels: Record<string, number>,
  technicalMastery: number
): number {
  const mixingBasic = skillLevels['songwriting_basic_mixing'] || 0;
  const mixingPro = skillLevels['songwriting_professional_mixing'] || 0;
  const mixingMastery = skillLevels['songwriting_mastery_mixing'] || 0;
  
  const dawBasic = skillLevels['songwriting_basic_daw'] || 0;
  const dawPro = skillLevels['songwriting_professional_daw'] || 0;
  const dawMastery = skillLevels['songwriting_mastery_daw'] || 0;
  
  // Calculate mixing contribution
  const mixingBase = Math.min(50, mixingBasic * 0.5);
  const mixingProC = Math.min(40, mixingPro * 0.5);
  const mixingMastC = Math.min(50, mixingMastery * 0.6);
  
  // Calculate DAW contribution  
  const dawBase = Math.min(40, dawBasic * 0.4);
  const dawProC = Math.min(30, dawPro * 0.4);
  const dawMastC = Math.min(40, dawMastery * 0.5);
  
  const skillBase = mixingBase + mixingProC + mixingMastC + dawBase + dawProC + dawMastC;
  const attrBonus = Math.min(80, technicalMastery * 0.08);
  
  return skillBase + attrBonus;
}

// Component-level variance (small adjustments per area)
function getComponentVariance(): number {
  // Smaller variance per component: 0.92 to 1.08
  return 0.92 + Math.random() * 0.16;
}

// Apply component variance to a strength value
function applyComponentVariance(baseValue: number): number {
  return Math.round(baseValue * getComponentVariance());
}

// Main quality calculation function
export function calculateSongQuality(inputs: SongQualityInputs): SongQualityResult {
  // Get session-wide luck factor (affects final score)
  const sessionLuck = getSessionLuck();
  
  // Calculate base strengths with small component variance
  const melodyStrength = applyComponentVariance(calculateMelodyStrength(
    inputs.skillLevels,
    inputs.attributes.musical_ability
  ));
  
  const lyricsStrength = applyComponentVariance(calculateLyricsStrength(
    inputs.skillLevels,
    inputs.attributes.creative_insight,
    inputs.aiLyrics
  ));
  
  const rhythmStrength = applyComponentVariance(calculateRhythmStrength(inputs.skillLevels));
  
  const arrangementStrength = applyComponentVariance(calculateArrangementStrength(
    inputs.skillLevels,
    inputs.coWriters
  ));
  
  const productionPotential = applyComponentVariance(calculateProductionPotential(
    inputs.skillLevels,
    inputs.attributes.technical_mastery
  ));
  
  // Calculate genre familiarity multiplier (1.0 to 1.5x)
  const genreSkillSlug = getGenreSkillSlug(inputs.genre, 'basic');
  const genreFamiliarity = genreSkillSlug ? (inputs.skillLevels[genreSkillSlug] || 0) : 0;
  const genreMultiplier = 1 + Math.min(0.5, genreFamiliarity / 500);
  
  // Sum all areas
  const rawTotal = melodyStrength + lyricsStrength + rhythmStrength + 
                   arrangementStrength + productionPotential;
  
  // Apply genre multiplier
  const withGenreBonus = rawTotal * genreMultiplier;
  
  // Apply session luck to final score (the big swing)
  const withLuck = withGenreBonus * sessionLuck.multiplier;
  
  // Apply skill ceiling
  const skillCeiling = getSkillCeiling(inputs.skillLevels);
  const totalQuality = Math.min(skillCeiling, Math.round(withLuck));
  
  return {
    totalQuality,
    melodyStrength,
    lyricsStrength,
    rhythmStrength,
    arrangementStrength,
    productionPotential,
    genreMultiplier,
    skillCeiling,
    sessionLuckLabel: `${sessionLuck.emoji} ${sessionLuck.label}`,
    sessionLuckMultiplier: sessionLuck.multiplier
  };
}
