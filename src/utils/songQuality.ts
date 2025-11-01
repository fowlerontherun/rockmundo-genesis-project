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
}

// Check if player can start songwriting
export function canStartSongwriting(skillLevels: Record<string, number>): boolean {
  return (skillLevels['songwriting_basic_composing'] || 0) >= 10;
}

// Check if player can write in a specific genre
export function canWriteGenre(genre: string, skillLevels: Record<string, number>): boolean {
  const genreSkillSlug = getGenreSkillSlug(genre, 'basic');
  if (!genreSkillSlug) return false;
  
  // Check new format (genres_basic_*)
  if ((skillLevels[genreSkillSlug] || 0) >= 1) return true;
  
  // Check legacy format (basic_*)
  const legacySlug = genreSkillSlug.replace('genres_basic_', 'basic_');
  return (skillLevels[legacySlug] || 0) >= 1;
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

// Calculate melody strength (0-200)
function calculateMelodyStrength(
  skillLevels: Record<string, number>,
  musicalAbility: number
): number {
  const basicSkill = skillLevels['songwriting_basic_composing'] || 0;
  const proSkill = skillLevels['songwriting_professional_composing'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_composing_anthems'] || 0;
  
  // Base from skills (max 150)
  const skillBase = Math.min(150, (basicSkill + proSkill * 1.5 + masterySkill * 2) / 3);
  
  // Attribute bonus (max 50)
  const attrBonus = Math.min(50, musicalAbility / 2);
  
  return Math.round(skillBase + attrBonus);
}

// Calculate lyrics strength (0-200)
function calculateLyricsStrength(
  skillLevels: Record<string, number>,
  creativeInsight: number,
  aiPenalty: boolean
): number {
  const basicSkill = skillLevels['songwriting_basic_lyrics'] || 0;
  const proSkill = skillLevels['songwriting_professional_lyrics'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_lyrics'] || 0;
  
  const skillBase = Math.min(150, (basicSkill + proSkill * 1.5 + masterySkill * 2) / 3);
  const attrBonus = Math.min(50, creativeInsight / 2);
  
  const total = skillBase + attrBonus;
  return Math.round(aiPenalty ? total * 0.9 : total); // -10% for AI
}

// Calculate rhythm strength (0-200)
function calculateRhythmStrength(skillLevels: Record<string, number>): number {
  const basicSkill = skillLevels['songwriting_basic_beatmaking'] || 0;
  const proSkill = skillLevels['songwriting_professional_beatmaking'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_beatmaking'] || 0;
  
  return Math.round(Math.min(200, (basicSkill + proSkill * 1.5 + masterySkill * 2) / 3));
}

// Calculate arrangement strength (0-200)
function calculateArrangementStrength(
  skillLevels: Record<string, number>,
  coWriters: number
): number {
  const basicSkill = skillLevels['songwriting_basic_record_production'] || 0;
  const proSkill = skillLevels['songwriting_professional_record_production'] || 0;
  const masterySkill = skillLevels['songwriting_mastery_record_production'] || 0;
  
  const skillBase = Math.min(180, (basicSkill + proSkill * 1.5 + masterySkill * 2) / 3);
  
  // Collaboration bonus (max +20)
  const collabBonus = Math.min(20, coWriters * 5);
  
  return Math.round(skillBase + collabBonus);
}

// Calculate production potential (0-200)
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
  
  const mixingScore = (mixingBasic + mixingPro * 1.5 + mixingMastery * 2) / 3;
  const dawScore = (dawBasic + dawPro * 1.5 + dawMastery * 2) / 3;
  
  const skillBase = Math.min(150, (mixingScore + dawScore) / 2);
  const attrBonus = Math.min(50, technicalMastery / 2);
  
  return Math.round(skillBase + attrBonus);
}

// Main quality calculation function
export function calculateSongQuality(inputs: SongQualityInputs): SongQualityResult {
  const melodyStrength = calculateMelodyStrength(
    inputs.skillLevels,
    inputs.attributes.musical_ability
  );
  
  const lyricsStrength = calculateLyricsStrength(
    inputs.skillLevels,
    inputs.attributes.creative_insight,
    inputs.aiLyrics
  );
  
  const rhythmStrength = calculateRhythmStrength(inputs.skillLevels);
  
  const arrangementStrength = calculateArrangementStrength(
    inputs.skillLevels,
    inputs.coWriters
  );
  
  const productionPotential = calculateProductionPotential(
    inputs.skillLevels,
    inputs.attributes.technical_mastery
  );
  
  // Calculate genre familiarity multiplier (1.0 to 1.5x)
  const genreSkillSlug = getGenreSkillSlug(inputs.genre, 'basic');
  const genreFamiliarity = genreSkillSlug ? (inputs.skillLevels[genreSkillSlug] || 0) : 0;
  const genreMultiplier = 1 + Math.min(0.5, genreFamiliarity / 500);
  
  // Sum all areas
  const rawTotal = melodyStrength + lyricsStrength + rhythmStrength + 
                   arrangementStrength + productionPotential;
  
  // Apply genre multiplier
  const withGenreBonus = rawTotal * genreMultiplier;
  
  // Apply skill ceiling
  const skillCeiling = getSkillCeiling(inputs.skillLevels);
  const totalQuality = Math.min(skillCeiling, Math.round(withGenreBonus));
  
  return {
    totalQuality,
    melodyStrength,
    lyricsStrength,
    rhythmStrength,
    arrangementStrength,
    productionPotential,
    genreMultiplier,
    skillCeiling
  };
}
