// Band Chemistry Effects Calculator
// Chemistry affects multiple aspects of gig performance

export interface ChemistryEffects {
  performanceBonus: number;      // % bonus to song performance scores
  rehearsalEfficiency: number;   // % bonus to rehearsal familiarity gains
  crowdConnectionBonus: number;  // % bonus to crowd engagement
  recoveryBonus: number;         // % reduction in bad song penalty
  encoreChance: number;          // % chance of triggering encore demand
  breakdownReduction: number;    // % reduction in technical issues
}

export interface ChemistryMoment {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  chemistryImpact: number;
}

const CHEMISTRY_TIERS = {
  legendary: { min: 90, label: 'Legendary', color: 'text-purple-500' },
  excellent: { min: 75, label: 'Excellent', color: 'text-green-500' },
  good: { min: 50, label: 'Good', color: 'text-blue-500' },
  developing: { min: 25, label: 'Developing', color: 'text-yellow-500' },
  strained: { min: 0, label: 'Strained', color: 'text-red-500' },
};

export function getChemistryTier(chemistryLevel: number) {
  if (chemistryLevel >= CHEMISTRY_TIERS.legendary.min) return CHEMISTRY_TIERS.legendary;
  if (chemistryLevel >= CHEMISTRY_TIERS.excellent.min) return CHEMISTRY_TIERS.excellent;
  if (chemistryLevel >= CHEMISTRY_TIERS.good.min) return CHEMISTRY_TIERS.good;
  if (chemistryLevel >= CHEMISTRY_TIERS.developing.min) return CHEMISTRY_TIERS.developing;
  return CHEMISTRY_TIERS.strained;
}

export function calculateChemistryEffects(chemistryLevel: number): ChemistryEffects {
  // Normalize chemistry to 0-100 range
  const normalizedChemistry = Math.max(0, Math.min(100, chemistryLevel));
  
  // Performance bonus: -10% to +15% based on chemistry
  const performanceBonus = (normalizedChemistry - 50) * 0.3;
  
  // Rehearsal efficiency: 0% to +30% bonus
  const rehearsalEfficiency = normalizedChemistry * 0.3;
  
  // Crowd connection: -5% to +20% bonus
  const crowdConnectionBonus = (normalizedChemistry - 25) * 0.25;
  
  // Recovery from bad songs: 0% to 50% penalty reduction
  const recoveryBonus = normalizedChemistry * 0.5;
  
  // Encore chance: 0% to 40% base chance
  const encoreChance = Math.max(0, (normalizedChemistry - 50) * 0.8);
  
  // Breakdown reduction: 0% to 25% reduction in technical issues
  const breakdownReduction = normalizedChemistry * 0.25;

  return {
    performanceBonus: Math.round(performanceBonus * 10) / 10,
    rehearsalEfficiency: Math.round(rehearsalEfficiency * 10) / 10,
    crowdConnectionBonus: Math.round(crowdConnectionBonus * 10) / 10,
    recoveryBonus: Math.round(recoveryBonus * 10) / 10,
    encoreChance: Math.round(encoreChance * 10) / 10,
    breakdownReduction: Math.round(breakdownReduction * 10) / 10,
  };
}

export function generateChemistryMoments(
  chemistryLevel: number,
  gigRating: number,
  songCount: number
): ChemistryMoment[] {
  const moments: ChemistryMoment[] = [];
  const effects = calculateChemistryEffects(chemistryLevel);
  const tier = getChemistryTier(chemistryLevel);

  // High chemistry moments
  if (chemistryLevel >= 80) {
    if (Math.random() < 0.4) {
      moments.push({
        type: 'positive',
        title: 'Perfect Sync',
        description: 'The band played in perfect harmony, feeding off each other\'s energy.',
        chemistryImpact: 2,
      });
    }
    if (gigRating >= 20 && Math.random() < 0.3) {
      moments.push({
        type: 'positive',
        title: 'Telepathic Performance',
        description: 'The band anticipated each other\'s moves flawlessly throughout the set.',
        chemistryImpact: 3,
      });
    }
  }

  // Medium chemistry moments
  if (chemistryLevel >= 50 && chemistryLevel < 80) {
    if (Math.random() < 0.3) {
      moments.push({
        type: 'positive',
        title: 'Growing Together',
        description: 'The band showed moments of real connection during the performance.',
        chemistryImpact: 1,
      });
    }
  }

  // Low chemistry moments
  if (chemistryLevel < 40) {
    if (Math.random() < 0.4) {
      moments.push({
        type: 'negative',
        title: 'Timing Issues',
        description: 'Some members seemed out of sync during transitions.',
        chemistryImpact: -1,
      });
    }
    if (chemistryLevel < 25 && Math.random() < 0.3) {
      moments.push({
        type: 'negative',
        title: 'Visible Tension',
        description: 'The audience noticed some tension between band members on stage.',
        chemistryImpact: -2,
      });
    }
  }

  // Rating-based moments
  if (gigRating >= 22 && chemistryLevel >= 60) {
    if (Math.random() < effects.encoreChance / 100) {
      moments.push({
        type: 'positive',
        title: 'Encore Demanded!',
        description: 'The crowd wouldn\'t let the band leave without an encore!',
        chemistryImpact: 2,
      });
    }
  }

  return moments;
}

export function applyChemistryToPerformance(
  baseScore: number,
  chemistryLevel: number
): number {
  const effects = calculateChemistryEffects(chemistryLevel);
  const modifier = 1 + (effects.performanceBonus / 100);
  return Math.min(25, baseScore * modifier);
}
