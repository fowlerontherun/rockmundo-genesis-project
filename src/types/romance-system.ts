// Romantic Progression System — Types & Configuration

// ─── Stage Definitions ─────────────────────────────────

export type RomanceStage =
  | 'flirting'
  | 'dating'
  | 'exclusive'
  | 'public_relationship'
  | 'engaged'
  | 'married'
  | 'separated'
  | 'divorced'
  | 'secret_affair';

export interface RomanceStageDefinition {
  id: RomanceStage;
  label: string;
  emoji: string;
  order: number;
  /** Minimum scores to advance TO this stage */
  requirements: {
    attraction: number;
    passion: number;
    commitment: number;
    maxTension: number; // Must be below this
  };
  /** What this stage unlocks */
  unlocks: string[];
  /** Emotional impacts when entering this stage */
  emotionalImpact: {
    happiness: number;
    loneliness: number;
    jealousy: number;
    obsession: number;
  };
  /** Reputation impact when entering (public stages only) */
  reputationImpact: {
    axis: 'authenticity' | 'attitude' | 'reliability' | 'creativity';
    change: number;
  } | null;
  /** Band chemistry modifier if partners are in the same band */
  bandChemistryModifier: number;
  /** Whether this stage is visible to the public */
  isPublic: boolean;
}

export const ROMANCE_STAGES: RomanceStageDefinition[] = [
  {
    id: 'flirting',
    label: 'Flirting',
    emoji: '😏',
    order: 0,
    requirements: { attraction: 0, passion: 0, commitment: 0, maxTension: 100 },
    unlocks: ['Flirty chat options', 'Send compliments', 'Subtle gifts'],
    emotionalImpact: { happiness: 5, loneliness: -5, jealousy: 0, obsession: 3 },
    reputationImpact: null,
    bandChemistryModifier: 0,
    isPublic: false,
  },
  {
    id: 'dating',
    label: 'Dating',
    emoji: '💐',
    order: 1,
    requirements: { attraction: 40, passion: 30, commitment: 10, maxTension: 60 },
    unlocks: ['Go on dates', 'Romantic gifts', 'Duet songwriting bonus', 'Private messages'],
    emotionalImpact: { happiness: 10, loneliness: -15, jealousy: 5, obsession: 5 },
    reputationImpact: null,
    bandChemistryModifier: 3,
    isPublic: false,
  },
  {
    id: 'exclusive',
    label: 'Exclusive',
    emoji: '💕',
    order: 2,
    requirements: { attraction: 55, passion: 45, commitment: 30, maxTension: 50 },
    unlocks: ['Exclusive dialogue', 'Jealousy triggers active', 'Loyalty bonus', 'Joint social posts'],
    emotionalImpact: { happiness: 12, loneliness: -20, jealousy: 10, obsession: 8 },
    reputationImpact: null,
    bandChemistryModifier: 5,
    isPublic: false,
  },
  {
    id: 'public_relationship',
    label: 'Public Relationship',
    emoji: '❤️',
    order: 3,
    requirements: { attraction: 60, passion: 50, commitment: 45, maxTension: 45 },
    unlocks: ['Media coverage', 'Joint interviews', 'Couple merch', 'Fame boost from appearances', 'Affair risk begins'],
    emotionalImpact: { happiness: 15, loneliness: -25, jealousy: 8, obsession: 5 },
    reputationImpact: { axis: 'authenticity', change: 5 },
    bandChemistryModifier: 8,
    isPublic: true,
  },
  {
    id: 'engaged',
    label: 'Engaged',
    emoji: '💍',
    order: 4,
    requirements: { attraction: 65, passion: 55, commitment: 70, maxTension: 35 },
    unlocks: ['Wedding planning', 'Engagement press event', 'Fiancé title', 'Shared finances option'],
    emotionalImpact: { happiness: 20, loneliness: -30, jealousy: 5, obsession: 10 },
    reputationImpact: { axis: 'reliability', change: 8 },
    bandChemistryModifier: 10,
    isPublic: true,
  },
  {
    id: 'married',
    label: 'Married',
    emoji: '💒',
    order: 5,
    requirements: { attraction: 60, passion: 50, commitment: 80, maxTension: 30 },
    unlocks: ['Shared home base', 'Joint bank account', 'Spouse title', 'Tax benefits', 'Maximum loyalty bonus', 'Divorce consequences active'],
    emotionalImpact: { happiness: 25, loneliness: -35, jealousy: 3, obsession: 5 },
    reputationImpact: { axis: 'reliability', change: 12 },
    bandChemistryModifier: 12,
    isPublic: true,
  },
  {
    id: 'separated',
    label: 'Separated',
    emoji: '💔',
    order: 6,
    requirements: { attraction: 0, passion: 0, commitment: 0, maxTension: 100 },
    unlocks: ['Reconciliation attempts', 'Separation press event', 'Solo activities resume'],
    emotionalImpact: { happiness: -20, loneliness: 25, jealousy: 15, obsession: 10 },
    reputationImpact: { axis: 'attitude', change: -5 },
    bandChemistryModifier: -10,
    isPublic: true,
  },
  {
    id: 'divorced',
    label: 'Divorced',
    emoji: '📝',
    order: 7,
    requirements: { attraction: 0, passion: 0, commitment: 0, maxTension: 100 },
    unlocks: ['Ex-partner interactions', 'Rebound dating', 'Divorce album bonus', 'Asset splitting'],
    emotionalImpact: { happiness: -15, loneliness: 20, jealousy: 10, obsession: -10 },
    reputationImpact: { axis: 'authenticity', change: -3 },
    bandChemistryModifier: -15,
    isPublic: true,
  },
  {
    id: 'secret_affair',
    label: 'Secret Affair',
    emoji: '🤫',
    order: -1, // Can happen at any stage
    requirements: { attraction: 50, passion: 60, commitment: 0, maxTension: 100 },
    unlocks: ['Clandestine meetings', 'Guilt mechanics', 'Detection risk per interaction', 'Scandal potential'],
    emotionalImpact: { happiness: 10, loneliness: -10, jealousy: 20, obsession: 20 },
    reputationImpact: null, // Only impacts if caught
    bandChemistryModifier: -5,
    isPublic: false,
  },
];

// ─── DB Row Type ────────────────────────────────────────

export interface RomanticRelationship {
  id: string;
  partner_a_id: string;
  partner_a_type: 'player' | 'npc';
  partner_b_id: string;
  partner_b_type: 'player' | 'npc';
  partner_b_name: string;
  stage: RomanceStage;
  attraction_score: number;
  compatibility_score: number;
  passion_score: number;
  commitment_score: number;
  tension_score: number;
  is_secret: boolean;
  affair_suspicion: number;
  affair_detected: boolean;
  affair_detected_at: string | null;
  is_active: boolean;
  initiated_by: string | null;
  ended_by: string | null;
  end_reason: string | null;
  stage_changed_at: string | null;
  last_date_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface RomanticEvent {
  id: string;
  romance_id: string;
  event_type: string;
  old_stage: string | null;
  new_stage: string | null;
  attraction_change: number;
  passion_change: number;
  commitment_change: number;
  tension_change: number;
  suspicion_change: number;
  reputation_axis: string | null;
  reputation_change: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Attraction Algorithm ───────────────────────────────

export interface AttractionFactors {
  fameGap: number;         // Difference in fame (celebrity attraction)
  sharedGenres: number;    // 0–5 how many genres overlap
  personalityMatch: number; // 0–100 from trait compatibility
  physicalAttraction: number; // Base attraction score
  reputationAlignment: number; // How aligned their reputation axes are
  proximityBonus: number;  // Same city bonus
}

/**
 * Calculate attraction score from factors.
 * Returns 0–100.
 */
export function calculateAttraction(factors: AttractionFactors): number {
  const {
    fameGap,
    sharedGenres,
    personalityMatch,
    physicalAttraction,
    reputationAlignment,
    proximityBonus,
  } = factors;

  // Fame gap: small gap = good, huge gap = less chemistry (power imbalance)
  const fameScore = Math.max(0, 100 - Math.abs(fameGap) / 50);

  // Genre overlap: 0-5 genres → 0-100
  const genreScore = Math.min(100, sharedGenres * 20);

  const raw =
    physicalAttraction * 0.25 +
    personalityMatch * 0.25 +
    genreScore * 0.15 +
    fameScore * 0.15 +
    reputationAlignment * 0.10 +
    proximityBonus * 0.10;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ─── Compatibility Scoring ──────────────────────────────

export interface CompatibilityFactors {
  traitOverlap: number;     // 0–100 how many traits are compatible
  traitConflicts: number;   // 0–5 number of incompatible trait pairs
  genreAlignment: number;   // 0–100 musical taste alignment
  ambitionMatch: number;    // 0–100 career goals similarity
  lifestyleMatch: number;   // 0–100 (e.g., both night owls, both health-focused)
}

/**
 * Calculate compatibility score.
 * Returns 0–100.
 */
export function calculateCompatibility(factors: CompatibilityFactors): number {
  const conflictPenalty = factors.traitConflicts * 12; // Each conflict costs 12 points

  const raw =
    factors.traitOverlap * 0.30 +
    factors.genreAlignment * 0.25 +
    factors.ambitionMatch * 0.25 +
    factors.lifestyleMatch * 0.20 -
    conflictPenalty;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

// ─── Rejection Consequences ─────────────────────────────

export interface RejectionConsequences {
  happiness_change: number;
  loneliness_change: number;
  resentment_change: number;
  obsession_change: number;
  attraction_loss: number;
  reputation_change: number;
  bandChemistry_change: number;
}

/**
 * Calculate rejection impact based on stage and relationship depth.
 */
export function calculateRejectionConsequences(
  stage: RomanceStage,
  commitment: number,
  isPublic: boolean,
): RejectionConsequences {
  const stageDef = ROMANCE_STAGES.find(s => s.id === stage);
  const depth = (stageDef?.order ?? 0) + 1;
  const publicMultiplier = isPublic ? 1.5 : 1.0;

  return {
    happiness_change: Math.round(-8 * depth * publicMultiplier),
    loneliness_change: Math.round(5 * depth),
    resentment_change: Math.round(3 * depth + commitment * 0.15),
    obsession_change: Math.round(2 * depth),
    attraction_loss: Math.round(-10 * depth),
    reputation_change: isPublic ? Math.round(-3 * depth) : 0,
    bandChemistry_change: Math.round(-5 * depth),
  };
}

// ─── Affair Detection ───────────────────────────────────

/**
 * Calculate probability of an affair being detected per interaction.
 * Returns 0–100 probability percentage.
 */
export function calculateAffairDetectionChance(params: {
  currentSuspicion: number;   // 0–100
  partnerFame: number;        // Higher fame = more paparazzi
  isPublicVenue: boolean;     // Meeting in public?
  interactionIntensity: number; // 1–5 (casual chat vs passionate encounter)
  partnerHasRival: boolean;   // Rivals are more vigilant
  socialMediaActivity: number; // 0–100 how active on social media
}): number {
  const {
    currentSuspicion,
    partnerFame,
    isPublicVenue,
    interactionIntensity,
    partnerHasRival,
    socialMediaActivity,
  } = params;

  let chance = 3; // Base 3% per interaction

  // Suspicion amplifies detection
  chance += currentSuspicion * 0.3;

  // Fame attracts paparazzi
  chance += Math.min(20, partnerFame / 500);

  // Public venues are risky
  if (isPublicVenue) chance += 15;

  // Intensity of the interaction
  chance += interactionIntensity * 4;

  // Rivals watch closely
  if (partnerHasRival) chance += 10;

  // Social media leaves traces
  chance += socialMediaActivity * 0.1;

  // Random variance ±5%
  chance += (Math.random() - 0.5) * 10;

  return Math.round(Math.max(1, Math.min(95, chance)));
}

// ─── Stage Transition Helpers ───────────────────────────

/**
 * Check if a romance can advance to the next stage.
 */
export function canAdvanceStage(romance: RomanticRelationship): {
  canAdvance: boolean;
  nextStage: RomanceStage | null;
  missingRequirements: string[];
} {
  const currentDef = ROMANCE_STAGES.find(s => s.id === romance.stage);
  if (!currentDef) return { canAdvance: false, nextStage: null, missingRequirements: ['Unknown stage'] };

  // Find next stage by order
  const nextDef = ROMANCE_STAGES
    .filter(s => s.order > currentDef.order && s.order >= 0)
    .sort((a, b) => a.order - b.order)[0];

  if (!nextDef) return { canAdvance: false, nextStage: null, missingRequirements: ['Already at final stage'] };

  const missing: string[] = [];
  if (romance.attraction_score < nextDef.requirements.attraction)
    missing.push(`Attraction ${romance.attraction_score}/${nextDef.requirements.attraction}`);
  if (romance.passion_score < nextDef.requirements.passion)
    missing.push(`Passion ${romance.passion_score}/${nextDef.requirements.passion}`);
  if (romance.commitment_score < nextDef.requirements.commitment)
    missing.push(`Commitment ${romance.commitment_score}/${nextDef.requirements.commitment}`);
  if (romance.tension_score > nextDef.requirements.maxTension)
    missing.push(`Tension too high ${romance.tension_score}/${nextDef.requirements.maxTension}`);

  return {
    canAdvance: missing.length === 0,
    nextStage: nextDef.id,
    missingRequirements: missing,
  };
}

/**
 * Get the stage definition for a given stage ID
 */
export function getStageDefinition(stage: RomanceStage): RomanceStageDefinition | undefined {
  return ROMANCE_STAGES.find(s => s.id === stage);
}
