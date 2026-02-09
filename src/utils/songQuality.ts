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
  /** Number of songs previously completed by this player */
  songsWritten?: number;
  /** Number of sessions spent on this specific project */
  sessionsCompleted?: number;
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
  experienceBonus: number;
  sessionDepthBonus: number;
}

// Session luck labels for display
const SESSION_LUCK_LABELS: Record<string, { min: number; max: number; label: string; emoji: string }> = {
  terrible: { min: 0.75, max: 0.82, label: "Terrible Day", emoji: "😰" },
  off: { min: 0.82, max: 0.90, label: "Off Day", emoji: "😐" },
  normal: { min: 0.90, max: 1.10, label: "Normal Session", emoji: "🎵" },
  inspired: { min: 1.10, max: 1.22, label: "Inspired!", emoji: "✨" },
  lightning: { min: 1.22, max: 1.35, label: "Lightning Strike!", emoji: "⚡" }
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
// Widened range for more dramatic outcomes
function getSessionLuck(): { multiplier: number; label: string; emoji: string } {
  const roll = Math.random();
  
  if (roll < 0.05) {
    // 5% - Terrible day (-18-25%)
    const multiplier = 0.75 + Math.random() * 0.07;
    return { multiplier, label: "Terrible Day", emoji: "😰" };
  }
  if (roll < 0.15) {
    // 10% - Off day (-10-18%)
    const multiplier = 0.82 + Math.random() * 0.08;
    return { multiplier, label: "Off Day", emoji: "😐" };
  }
  if (roll < 0.82) {
    // 67% - Normal (-7% to +7%)
    const multiplier = 0.93 + Math.random() * 0.14;
    return { multiplier, label: "Normal Session", emoji: "🎵" };
  }
  if (roll < 0.93) {
    // 11% - Inspired (+10-22%)
    const multiplier = 1.10 + Math.random() * 0.12;
    return { multiplier, label: "Inspired!", emoji: "✨" };
  }
  // 7% - Lightning strike (+22-35%)
  const multiplier = 1.22 + Math.random() * 0.13;
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
  
  const basicContribution = Math.min(60, basicSkill * 0.6);
  const proContribution = Math.min(70, proSkill * 0.9);
  const masteryContribution = Math.min(90, masterySkill * 1.1);
  
  const skillBase = basicContribution + proContribution + masteryContribution;
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
  
  const basicContribution = Math.min(50, basicSkill * 0.5);
  const proContribution = Math.min(80, proSkill * 1.0);
  const masteryContribution = Math.min(90, masterySkill * 1.1);
  
  const skillBase = basicContribution + proContribution + masteryContribution;
  const attrBonus = Math.min(80, creativeInsight * 0.08);
  
  const total = skillBase + attrBonus;
  return aiPenalty ? total * 0.85 : total;
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
  
  const mixingBase = Math.min(50, mixingBasic * 0.5);
  const mixingProC = Math.min(40, mixingPro * 0.5);
  const mixingMastC = Math.min(50, mixingMastery * 0.6);
  
  const dawBase = Math.min(40, dawBasic * 0.4);
  const dawProC = Math.min(30, dawPro * 0.4);
  const dawMastC = Math.min(40, dawMastery * 0.5);
  
  const skillBase = mixingBase + mixingProC + mixingMastC + dawBase + dawProC + dawMastC;
  const attrBonus = Math.min(80, technicalMastery * 0.08);
  
  return skillBase + attrBonus;
}

// Component-level variance (wider adjustments per area for more unpredictability)
function getComponentVariance(): number {
  // Wider variance per component: 0.85 to 1.15
  return 0.85 + Math.random() * 0.30;
}

// Apply component variance to a strength value
function applyComponentVariance(baseValue: number): number {
  return Math.round(baseValue * getComponentVariance());
}

/**
 * Calculate experience bonus from songs previously written.
 * Diminishing returns: first songs matter most.
 * Range: 0-50 quality points bonus.
 */
function calculateExperienceBonus(songsWritten: number): number {
  if (songsWritten <= 0) return 0;
  // sqrt curve: 1 song = +8, 4 songs = +16, 9 songs = +24, 16 songs = +32, 25 songs = +40, 36+ songs → caps at 50
  return Math.min(50, Math.round(Math.sqrt(songsWritten) * 8));
}

/**
 * Calculate session depth bonus: more sessions = more refined song.
 * Songs that took longer to write get a quality bonus.
 * Range: 0-35 quality points bonus (kicks in after 3 sessions).
 */
function calculateSessionDepthBonus(sessionsCompleted: number): number {
  if (sessionsCompleted <= 3) return 0;
  // Each session beyond 3 adds ~8 points, capped at 35
  return Math.min(35, (sessionsCompleted - 3) * 8);
}

// Main quality calculation function
export function calculateSongQuality(inputs: SongQualityInputs): SongQualityResult {
  // Get session-wide luck factor (affects final score)
  const sessionLuck = getSessionLuck();
  
  // Calculate base strengths with component variance
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
  
  // Experience bonus from previously written songs
  const experienceBonus = calculateExperienceBonus(inputs.songsWritten ?? 0);
  
  // Session depth bonus: songs that took more sessions are more refined
  const sessionDepthBonus = calculateSessionDepthBonus(inputs.sessionsCompleted ?? 0);
  
  // Sum all areas + bonuses
  const rawTotal = melodyStrength + lyricsStrength + rhythmStrength + 
                   arrangementStrength + productionPotential +
                   experienceBonus + sessionDepthBonus;
  
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
    sessionLuckMultiplier: sessionLuck.multiplier,
    experienceBonus,
    sessionDepthBonus,
  };
}
