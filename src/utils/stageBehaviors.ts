/**
 * Stage Behavior System
 * 
 * Each performance behavior type modifies gig performance calculations with 
 * distinct pros and cons. Players start with 6 base behaviors and can unlock 
 * more through skill mastery and experience.
 */

export interface StageBehaviorModifiers {
  /** Multiplier on crowd engagement / crowd response threshold (1.0 = neutral) */
  crowdEngagement: number;
  /** Multiplier on chemistry contribution (1.0 = neutral) */
  chemistryEffect: number;
  /** Multiplier on variance range — higher = more volatile (1.0 = neutral) */
  varianceMultiplier: number;
  /** Flat bonus/penalty to base score (in 0-100 space before star conversion) */
  baseScoreBonus: number;
  /** Multiplier on momentum effects (1.0 = neutral) */
  momentumEffect: number;
  /** Bonus to fame gained from gigs */
  fameMultiplier: number;
  /** Bonus to fan conversion from gigs */
  fanConversionMultiplier: number;
  /** Multiplier on opening song penalty (lower = less penalty) */
  openingPenaltyMultiplier: number;
  /** Bonus chance for positive random events (additive, e.g. 0.03 = +3%) */
  positiveEventBonus: number;
  /** Bonus chance for negative random events (additive, e.g. 0.03 = +3%) */
  negativeEventBonus: number;
}

export interface StageBehaviorDefinition {
  key: string;
  name: string;
  emoji: string;
  description: string;
  pros: string[];
  cons: string[];
  modifiers: StageBehaviorModifiers;
  /** Whether this is a starter behavior (always available) */
  isStarter: boolean;
  /** Requirements to unlock (null for starters) */
  unlockRequirement: {
    type: 'skill_level' | 'player_level' | 'gigs_played' | 'fame' | 'achievement';
    description: string;
    /** Specific check values */
    skillSlug?: string;
    minLevel?: number;
    minGigs?: number;
    minFame?: number;
    achievementId?: string;
  } | null;
}

const NEUTRAL_MODIFIERS: StageBehaviorModifiers = {
  crowdEngagement: 1.0,
  chemistryEffect: 1.0,
  varianceMultiplier: 1.0,
  baseScoreBonus: 0,
  momentumEffect: 1.0,
  fameMultiplier: 1.0,
  fanConversionMultiplier: 1.0,
  openingPenaltyMultiplier: 1.0,
  positiveEventBonus: 0,
  negativeEventBonus: 0,
};

export const STAGE_BEHAVIORS: Record<string, StageBehaviorDefinition> = {
  // ── STARTER BEHAVIORS ──
  standard: {
    key: 'standard',
    name: 'Standard',
    emoji: '🎵',
    description: 'A balanced, no-frills performance style. Reliable and consistent.',
    pros: [
      'No penalties — well-rounded approach',
      'Consistent performance across all songs',
      'Slightly reduced negative variance',
    ],
    cons: [
      'No standout bonuses',
      'Lower fame gain compared to flashier styles',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      varianceMultiplier: 0.9, // Slightly more consistent
      fameMultiplier: 0.95, // Slightly less memorable
    },
    isStarter: true,
    unlockRequirement: null,
  },

  aggressive: {
    key: 'aggressive',
    name: 'Aggressive',
    emoji: '🔥',
    description: 'High-intensity, raw energy performance. Electrifies the crowd but can backfire.',
    pros: [
      '+8% base score bonus from raw energy',
      '+25% crowd engagement boost',
      '+15% fame gain — audiences remember intensity',
      'Higher chance of positive crowd moments',
    ],
    cons: [
      '+30% performance variance — unpredictable',
      '-10% chemistry effect — clashes with bandmates',
      '+5% chance of negative events (broken strings, feedback)',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      baseScoreBonus: 8,
      crowdEngagement: 1.25,
      fameMultiplier: 1.15,
      varianceMultiplier: 1.30,
      chemistryEffect: 0.90,
      positiveEventBonus: 0.03,
      negativeEventBonus: 0.05,
    },
    isStarter: true,
    unlockRequirement: null,
  },

  confident: {
    key: 'confident',
    name: 'Confident',
    emoji: '😎',
    description: 'Cool, collected, and in command. The crowd feeds off your self-assurance.',
    pros: [
      '+5% base score from assured delivery',
      '+20% momentum effect — builds faster on good songs',
      'No opening song penalty — owns the stage from note one',
      '+5% fan conversion — audiences respect confidence',
    ],
    cons: [
      'Momentum losses also amplified by 20%',
      'Slightly lower chemistry (-5%) — less collaborative feel',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      baseScoreBonus: 5,
      momentumEffect: 1.20,
      openingPenaltyMultiplier: 0.0, // No opening jitters
      fanConversionMultiplier: 1.05,
      chemistryEffect: 0.95,
    },
    isStarter: true,
    unlockRequirement: null,
  },

  arrogant: {
    key: 'arrogant',
    name: 'Arrogant',
    emoji: '👑',
    description: 'Showboating, self-centered stage presence. High risk, high reward.',
    pros: [
      '+20% fame gain — love-them-or-hate-them factor',
      '+10% base score when momentum is positive',
      'Huge positive event bonus (+6%) — show-stealing moments',
    ],
    cons: [
      '-20% chemistry — bandmates feel overshadowed',
      '-15% crowd engagement with disappointed crowds',
      '+8% negative event chance — crowd may turn hostile',
      '-10% fan conversion — some fans find it off-putting',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      fameMultiplier: 1.20,
      baseScoreBonus: 3, // Small base bonus (conditional boost handled in calculator)
      positiveEventBonus: 0.06,
      chemistryEffect: 0.80,
      crowdEngagement: 0.95,
      negativeEventBonus: 0.08,
      fanConversionMultiplier: 0.90,
    },
    isStarter: true,
    unlockRequirement: null,
  },

  friendly: {
    key: 'friendly',
    name: 'Friendly',
    emoji: '🤗',
    description: 'Warm, approachable performer who genuinely connects with the audience.',
    pros: [
      '+20% chemistry effect — great band harmony',
      '+15% fan conversion — audiences become loyal fans',
      '+10% crowd engagement — genuine connection',
      'Reduced negative event chance (-3%)',
    ],
    cons: [
      '-5% fame gain — less "wow factor" for press',
      '-10% momentum effect — harder to build explosive energy',
      'Lower variance means lower ceiling for epic moments',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      chemistryEffect: 1.20,
      fanConversionMultiplier: 1.15,
      crowdEngagement: 1.10,
      negativeEventBonus: -0.03,
      fameMultiplier: 0.95,
      momentumEffect: 0.90,
      varianceMultiplier: 0.85,
    },
    isStarter: true,
    unlockRequirement: null,
  },

  nervous: {
    key: 'nervous',
    name: 'Nervous',
    emoji: '😰',
    description: 'Anxious energy that can either captivate or crash. Underdog appeal.',
    pros: [
      '+40% positive event bonus — crowd roots for the underdog',
      '+15% fan conversion when score is good — sympathetic appeal',
      'Chemistry unaffected — nervous energy is relatable',
    ],
    cons: [
      '-8% base score from anxiety-induced mistakes',
      '+40% variance — wildly unpredictable',
      'Double opening song penalty — nerves worst at start',
      '-10% crowd engagement — uncertain energy',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      positiveEventBonus: 0.06,
      fanConversionMultiplier: 1.15,
      baseScoreBonus: -8,
      varianceMultiplier: 1.40,
      openingPenaltyMultiplier: 2.0,
      crowdEngagement: 0.90,
    },
    isStarter: true,
    unlockRequirement: null,
  },

  // ── UNLOCKABLE BEHAVIORS ──
  legendary: {
    key: 'legendary',
    name: 'Legendary',
    emoji: '⚡',
    description: 'The stage presence of a true icon. Command attention with every breath.',
    pros: [
      '+12% base score from mastered presence',
      '+30% fame gain — every show is an event',
      '+20% crowd engagement',
      '+25% momentum effect',
    ],
    cons: [
      '-15% chemistry — overshadows bandmates',
      '+20% variance — genius is unpredictable',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      baseScoreBonus: 12,
      fameMultiplier: 1.30,
      crowdEngagement: 1.20,
      momentumEffect: 1.25,
      chemistryEffect: 0.85,
      varianceMultiplier: 1.20,
    },
    isStarter: false,
    unlockRequirement: {
      type: 'fame',
      description: 'Reach 5,000 fame',
      minFame: 5000,
    },
  },

  enigmatic: {
    key: 'enigmatic',
    name: 'Enigmatic',
    emoji: '🌙',
    description: 'Mysterious, brooding presence. The audience is drawn in by what you don\'t do.',
    pros: [
      '+25% fame gain — mystery creates buzz',
      '+20% fan conversion — audiences obsess over the enigma',
      'Very low variance — controlled, deliberate performance',
    ],
    cons: [
      '-15% crowd engagement — harder to read the performer',
      '-10% momentum effect — reserved energy doesn\'t snowball',
      'No positive event bonus — too controlled for spontaneity',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      fameMultiplier: 1.25,
      fanConversionMultiplier: 1.20,
      varianceMultiplier: 0.70,
      crowdEngagement: 0.85,
      momentumEffect: 0.90,
      positiveEventBonus: -0.04,
    },
    isStarter: false,
    unlockRequirement: {
      type: 'gigs_played',
      description: 'Perform 50 gigs',
      minGigs: 50,
    },
  },

  chaotic: {
    key: 'chaotic',
    name: 'Chaotic',
    emoji: '🎪',
    description: 'Pure unhinged energy. No one knows what will happen next — including you.',
    pros: [
      '+15% base score from sheer spectacle',
      '+35% fame gain — viral moments guaranteed',
      '+10% positive event bonus — anything can happen',
      '+30% crowd engagement — can\'t look away',
    ],
    cons: [
      '+60% variance — insanely unpredictable',
      '-25% chemistry — absolute chaos for the band',
      '+10% negative events — things WILL go wrong',
      'Terrible opening penalty (2.5x)',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      baseScoreBonus: 15,
      fameMultiplier: 1.35,
      positiveEventBonus: 0.10,
      crowdEngagement: 1.30,
      varianceMultiplier: 1.60,
      chemistryEffect: 0.75,
      negativeEventBonus: 0.10,
      openingPenaltyMultiplier: 2.5,
    },
    isStarter: false,
    unlockRequirement: {
      type: 'skill_level',
      description: 'Master Stage Presence (Level 15+)',
      skillSlug: 'stage_presence',
      minLevel: 15,
    },
  },

  virtuoso: {
    key: 'virtuoso',
    name: 'Virtuoso',
    emoji: '🎻',
    description: 'Let the music speak. Technical perfection that leaves audiences in awe.',
    pros: [
      '+10% base score from flawless technique',
      '+15% chemistry — tight, collaborative performance',
      'Very low variance — consistently excellent',
      'Reduced negative events (-5%)',
    ],
    cons: [
      '-10% crowd engagement — cerebral over visceral',
      '-10% fame gain — critics love it, press ignores it',
      '-15% momentum — methodical pace limits build-up',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      baseScoreBonus: 10,
      chemistryEffect: 1.15,
      varianceMultiplier: 0.75,
      negativeEventBonus: -0.05,
      crowdEngagement: 0.90,
      fameMultiplier: 0.90,
      momentumEffect: 0.85,
    },
    isStarter: false,
    unlockRequirement: {
      type: 'player_level',
      description: 'Reach Player Level 20',
      minLevel: 20,
    },
  },

  provocateur: {
    key: 'provocateur',
    name: 'Provocateur',
    emoji: '💀',
    description: 'Deliberately controversial. Push boundaries and make headlines.',
    pros: [
      '+40% fame gain — every show makes the news',
      '+25% crowd engagement — shock and awe',
      '+8% positive event bonus — spectacular moments',
    ],
    cons: [
      '-30% chemistry — band disputes escalate',
      '-20% fan conversion — polarizing personality',
      '+12% negative events — scandals, walkouts, injuries',
      '+25% variance — chaos factor',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      fameMultiplier: 1.40,
      crowdEngagement: 1.25,
      positiveEventBonus: 0.08,
      chemistryEffect: 0.70,
      fanConversionMultiplier: 0.80,
      negativeEventBonus: 0.12,
      varianceMultiplier: 1.25,
    },
    isStarter: false,
    unlockRequirement: {
      type: 'fame',
      description: 'Reach 10,000 fame',
      minFame: 10000,
    },
  },

  zen: {
    key: 'zen',
    name: 'Zen',
    emoji: '🧘',
    description: 'Calm, centered, transcendent. Performances feel like meditation.',
    pros: [
      '+25% chemistry — perfect harmony with bandmates',
      'Lowest variance — incredibly consistent',
      'No opening penalty — centered from the start',
      'Negative events reduced by 8%',
    ],
    cons: [
      '-15% crowd engagement — too calm for some crowds',
      '-20% fame gain — not flashy enough for headlines',
      '-20% momentum — no energy spikes',
    ],
    modifiers: {
      ...NEUTRAL_MODIFIERS,
      chemistryEffect: 1.25,
      varianceMultiplier: 0.60,
      openingPenaltyMultiplier: 0.0,
      negativeEventBonus: -0.08,
      crowdEngagement: 0.85,
      fameMultiplier: 0.80,
      momentumEffect: 0.80,
    },
    isStarter: false,
    unlockRequirement: {
      type: 'gigs_played',
      description: 'Perform 100 gigs',
      minGigs: 100,
    },
  },
};

/** Get all starter behaviors */
export function getStarterBehaviors(): StageBehaviorDefinition[] {
  return Object.values(STAGE_BEHAVIORS).filter(b => b.isStarter);
}

/** Get all unlockable behaviors */
export function getUnlockableBehaviors(): StageBehaviorDefinition[] {
  return Object.values(STAGE_BEHAVIORS).filter(b => !b.isStarter);
}

/** Get behavior by key with fallback to standard */
export function getBehavior(key: string): StageBehaviorDefinition {
  return STAGE_BEHAVIORS[key] || STAGE_BEHAVIORS.standard;
}

/** Get modifiers for a behavior key */
export function getBehaviorModifiers(key: string): StageBehaviorModifiers {
  return getBehavior(key).modifiers;
}

/**
 * Apply stage behavior modifiers to performance calculation.
 * Returns an object with all the multipliers needed by the calculator.
 */
export function applyBehaviorToPerformance(
  behaviorKey: string,
  momentum: number = 0
): {
  baseScoreBonus: number;
  varianceMultiplier: number;
  chemistryMultiplier: number;
  crowdEngagementMultiplier: number;
  momentumMultiplier: number;
  openingPenaltyMultiplier: number;
  positiveEventBonus: number;
  negativeEventBonus: number;
  fameMultiplier: number;
  fanConversionMultiplier: number;
} {
  const mods = getBehaviorModifiers(behaviorKey);
  
  // Arrogant special: extra base bonus when momentum is positive
  let extraBaseBonus = 0;
  if (behaviorKey === 'arrogant' && momentum > 0) {
    extraBaseBonus = 7; // +7 extra when riding momentum
  }

  return {
    baseScoreBonus: mods.baseScoreBonus + extraBaseBonus,
    varianceMultiplier: mods.varianceMultiplier,
    chemistryMultiplier: mods.chemistryEffect,
    crowdEngagementMultiplier: mods.crowdEngagement,
    momentumMultiplier: mods.momentumEffect,
    openingPenaltyMultiplier: mods.openingPenaltyMultiplier,
    positiveEventBonus: mods.positiveEventBonus,
    negativeEventBonus: mods.negativeEventBonus,
    fameMultiplier: mods.fameMultiplier,
    fanConversionMultiplier: mods.fanConversionMultiplier,
  };
}
