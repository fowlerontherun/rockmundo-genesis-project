import type { SkillProgressRecord } from "@/hooks/useSkillSystem.types";

// Canonical DJ skill families from skill_definitions.
const DJ_CORE_SLUGS = [
  "basic_dj_controller",
  "professional_djing",
  "dj_mastery",
] as const;

const DJ_BONUS_SLUGS = [
  "basic_sampling_remixing",
  "professional_sampling_remixing",
  "sampling_remixing_mastery",
] as const;

export interface DjPerformanceInput {
  skillProgress: SkillProgressRecord[];
  stagePresence: number; // 0-100
  charisma: number; // 0-100
  clubQualityLevel: number; // 1-5
}

export interface DjPerformanceResult {
  score: number;
  outcomeLabel: string;
  outcomeDescription: string;
}

export interface DjOutcome {
  performanceScore: number;
  cashEarned: number;
  fameGained: number;
  fansGained: number;
  xpGained: number;
  outcomeLabel: string;
  outcomeDescription: string;
}

function getSkillLevel(progress: SkillProgressRecord[], slug: string): number {
  const entry = progress.find((p) => p.skill_slug === slug);
  return entry?.current_level ?? 0;
}

/**
 * DJ ability is the combined Basic → Professional → Mastery DJ progression,
 * normalized back to the legacy 0-20 scoring range.
 */
export function getDjSkillAverage(progress: SkillProgressRecord[]): number {
  const totalLevel = DJ_CORE_SLUGS.reduce(
    (total, slug) => total + getSkillLevel(progress, slug),
    0,
  );

  // Three 20-level tiers = 60 total levels, normalized to 0-20.
  return Math.min(20, totalLevel / 3);
}

/**
 * Sampling/remixing contributes a smaller DJ-performance bonus.
 */
function getDjBonusSkillAverage(progress: SkillProgressRecord[]): number {
  const totalLevel = DJ_BONUS_SLUGS.reduce(
    (total, slug) => total + getSkillLevel(progress, slug),
    0,
  );

  // Three 20-level tiers = 60 total levels, normalized to a 0-5 bonus.
  return Math.min(5, totalLevel / 12);
}

/**
 * Calculate DJ performance score (0-100).
 */
export function calculateDjPerformanceScore(input: DjPerformanceInput): DjPerformanceResult {
  const { skillProgress, stagePresence, charisma, clubQualityLevel } = input;

  const coreAvg = getDjSkillAverage(skillProgress);
  const bonusAvg = getDjBonusSkillAverage(skillProgress);

  // Base score from skills (0-25 combined → scaled to ~0-60 range)
  const baseScore = (coreAvg + bonusAvg) * 2.4;

  // Attribute bonus (up to +15)
  const attributeBonus = ((stagePresence * 0.6 + charisma * 0.4) / 100) * 15;

  // Club difficulty penalty (quality 1-5 → 3-15)
  const difficultyPenalty = clubQualityLevel * 3;

  // Variance roll (-8 to +8)
  const varianceRoll = Math.floor(Math.random() * 17) - 8;

  const finalScore = Math.max(0, Math.min(100, baseScore + attributeBonus - difficultyPenalty + varianceRoll));

  const { label, description } = getOutcomeLabel(finalScore);

  return {
    score: Math.round(finalScore),
    outcomeLabel: label,
    outcomeDescription: description,
  };
}

function getOutcomeLabel(score: number): { label: string; description: string } {
  if (score >= 85) return { label: "🔥 Crowd went wild!", description: "The crowd lost their minds — your set will be talked about for weeks." };
  if (score >= 65) return { label: "🎵 Solid set", description: "You held the floor and kept the energy right. A professional performance." };
  if (score >= 40) return { label: "😐 Rough night", description: "The crowd wasn't really feeling it. Some people drifted to the bar." };
  return { label: "💀 Cleared the floor", description: "Trainwreck. People literally left. Maybe stick to practicing." };
}

/**
 * Generate full DJ outcome including cash, fame, fans, XP.
 */
export function generateDjOutcome(
  score: number,
  outcomeLabel: string,
  outcomeDescription: string,
  clubPayout: number,
  clubQualityLevel: number,
  setLengthMinutes: number
): DjOutcome {
  // Cash earned scales with performance (70 = expected baseline)
  const cashMultiplier = Math.max(0.1, score / 70);
  const cashEarned = Math.round(clubPayout * cashMultiplier);

  // Fame gain scales with club quality and performance
  const fameGain = Math.max(0, Math.round(clubQualityLevel * 2 * (score / 50)));

  // Fan gain (small, local)
  const fansGained = score >= 65 ? Math.floor(Math.random() * (clubQualityLevel * 3)) + 1 : 0;

  // XP gain based on set length
  const xpGained = Math.round(setLengthMinutes * 0.5);

  return {
    performanceScore: score,
    cashEarned,
    fameGained: fameGain,
    fansGained,
    xpGained,
    outcomeLabel,
    outcomeDescription,
  };
}
