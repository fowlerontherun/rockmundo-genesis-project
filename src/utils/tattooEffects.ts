import type { PlayerTattoo } from "@/data/tattooDesigns";
import { getSleeveProgress } from "@/data/tattooDesigns";

/**
 * Calculate the total genre modifier from all of a player's tattoos
 * Returns a multiplier (e.g., 1.05 = +5% boost, 0.95 = -5% penalty)
 */
export function calculateTattooGenreModifier(
  playerTattoos: PlayerTattoo[],
  songGenre: string
): number {
  if (!playerTattoos || playerTattoos.length === 0) return 1.0;

  let totalModifier = 0;

  for (const tattoo of playerTattoos) {
    if (!tattoo.design?.genre_affinity) continue;
    
    const genreValue = tattoo.design.genre_affinity[songGenre] ?? 0;
    // Scale by quality (quality 100 = full effect, quality 50 = half effect)
    const qualityScale = tattoo.quality_score / 100;
    totalModifier += genreValue * qualityScale;
  }

  // Add sleeve completion bonuses
  const leftSleeve = getSleeveProgress(playerTattoos, 'left');
  const rightSleeve = getSleeveProgress(playerTattoos, 'right');
  
  if (leftSleeve.isComplete) totalModifier += 0.03;
  if (rightSleeve.isComplete) totalModifier += 0.03;

  // Cap total modifier between -20% and +25%
  const clampedModifier = Math.max(-0.20, Math.min(0.25, totalModifier));
  
  return 1.0 + clampedModifier;
}

/**
 * Calculate performance penalty from active infections
 */
export function calculateInfectionPenalty(playerTattoos: PlayerTattoo[]): number {
  const activeInfections = playerTattoos.filter(t => t.is_infected).length;
  if (activeInfections === 0) return 1.0;
  // Each infection: -3% performance
  return Math.max(0.85, 1.0 - activeInfections * 0.03);
}

/**
 * Calculate daily health drain from infections
 */
export function calculateInfectionHealthDrain(playerTattoos: PlayerTattoo[]): number {
  const activeInfections = playerTattoos.filter(t => t.is_infected).length;
  return activeInfections * 5; // -5 health per day per infection
}
