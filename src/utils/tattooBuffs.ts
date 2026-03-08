/**
 * Tattoo stat effects system.
 * Tattoos provide fame and minor stat buffs based on quantity, quality, and sleeve completion.
 */

import type { PlayerTattoo } from "@/data/tattooDesigns";
import { getSleeveProgress } from "@/data/tattooDesigns";

export interface TattooBuffs {
  fameBonus: number;           // flat fame bonus
  performanceBonus: number;    // multiplier for live performance, e.g. 1.03 = +3%
  intimidationBonus: number;   // flat intimidation/street cred
  infectionPenalty: number;    // multiplier penalty from infections, e.g. 0.97 = -3%
  totalTattoos: number;
  sleeveCount: number;         // 0, 1, or 2 completed sleeves
}

/**
 * Calculate tattoo buffs from a player's tattoo collection.
 */
export function calculateTattooBuffs(tattoos: PlayerTattoo[]): TattooBuffs {
  if (!tattoos || tattoos.length === 0) {
    return {
      fameBonus: 0,
      performanceBonus: 1,
      intimidationBonus: 0,
      infectionPenalty: 1,
      totalTattoos: 0,
      sleeveCount: 0,
    };
  }

  const activeTattoos = tattoos.filter(t => !t.is_infected || t.infection_cleared_at);
  const infectedTattoos = tattoos.filter(t => t.is_infected && !t.infection_cleared_at);

  // Fame: +2 per tattoo, bonus for high quality (80+), cap at +50
  const baseFame = activeTattoos.length * 2;
  const highQualityBonus = activeTattoos.filter(t => t.quality_score >= 80).length * 3;
  const fameBonus = Math.min(50, baseFame + highQualityBonus);

  // Performance: +1% per 3 tattoos, cap at +8%
  const performanceBonus = 1 + Math.min(0.08, Math.floor(activeTattoos.length / 3) * 0.01);

  // Sleeve completion bonuses
  const leftSleeve = getSleeveProgress(tattoos, 'left');
  const rightSleeve = getSleeveProgress(tattoos, 'right');
  let sleeveCount = 0;
  let sleeveFameBonus = 0;
  if (leftSleeve.isComplete) { sleeveCount++; sleeveFameBonus += 15; }
  if (rightSleeve.isComplete) { sleeveCount++; sleeveFameBonus += 15; }

  // Intimidation: tattoo count + sleeve bonus
  const intimidationBonus = Math.min(30, activeTattoos.length + sleeveCount * 10);

  // Infection penalty: -3% performance per infected tattoo
  const infectionPenalty = Math.max(0.85, 1 - infectedTattoos.length * 0.03);

  return {
    fameBonus: fameBonus + sleeveFameBonus,
    performanceBonus: performanceBonus * infectionPenalty,
    intimidationBonus,
    infectionPenalty,
    totalTattoos: tattoos.length,
    sleeveCount,
  };
}
