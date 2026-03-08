/**
 * Public Image & Reputation System (v1.0.931)
 * A composite reputation score affected by media interactions, scandals, charity, and behavior.
 * Reputation gates opportunities: label deals, sponsorships, festival invites, media interviews.
 */

export type ReputationTier = "toxic" | "controversial" | "neutral" | "respected" | "beloved" | "iconic";

export interface ReputationState {
  score: number;          // -100 to 100
  tier: ReputationTier;
  label: string;
  gateMultiplier: number; // 0.3 – 1.5 opportunity multiplier
  sponsorshipMod: number; // multiplier for sponsorship offers
  mediaAccessLevel: number; // 1-5 (what tier of media will talk to you)
}

interface ReputationEvent {
  type: string;
  impact: number;
}

// Events that affect reputation
export const REPUTATION_EVENTS: Record<string, number> = {
  // Positive
  charity_donation: 5,
  charity_concert: 10,
  fan_meet_greet: 3,
  positive_interview: 4,
  award_win: 8,
  community_service: 6,
  mentoring_player: 4,
  collaboration_completed: 3,

  // Negative
  scandal_minor: -8,
  scandal_major: -20,
  arrest: -15,
  drug_incident: -12,
  no_show_gig: -10,
  bad_interview: -5,
  band_drama_public: -7,
  contract_breach: -10,
  fan_altercation: -6,
};

function getTier(score: number): ReputationTier {
  if (score <= -60) return "toxic";
  if (score <= -20) return "controversial";
  if (score <= 20) return "neutral";
  if (score <= 50) return "respected";
  if (score <= 80) return "beloved";
  return "iconic";
}

const TIER_CONFIG: Record<ReputationTier, { label: string; gateMultiplier: number; sponsorshipMod: number; mediaAccessLevel: number }> = {
  toxic:         { label: "Toxic ☠️",          gateMultiplier: 0.3, sponsorshipMod: 0.1, mediaAccessLevel: 1 },
  controversial: { label: "Controversial ⚡",  gateMultiplier: 0.7, sponsorshipMod: 0.5, mediaAccessLevel: 2 },
  neutral:       { label: "Neutral ➡️",        gateMultiplier: 1.0, sponsorshipMod: 1.0, mediaAccessLevel: 3 },
  respected:     { label: "Respected ⭐",       gateMultiplier: 1.15, sponsorshipMod: 1.3, mediaAccessLevel: 4 },
  beloved:       { label: "Beloved 💖",         gateMultiplier: 1.3, sponsorshipMod: 1.6, mediaAccessLevel: 5 },
  iconic:        { label: "Iconic 👑",          gateMultiplier: 1.5, sponsorshipMod: 2.0, mediaAccessLevel: 5 },
};

/**
 * Calculate reputation state from a raw score.
 */
export function getReputationState(score: number): ReputationState {
  const clamped = Math.max(-100, Math.min(100, score));
  const tier = getTier(clamped);
  const config = TIER_CONFIG[tier];
  return { score: clamped, tier, ...config };
}

/**
 * Apply a reputation event and return the new score.
 */
export function applyReputationEvent(currentScore: number, eventKey: string): { newScore: number; change: number } {
  const change = REPUTATION_EVENTS[eventKey] ?? 0;
  const newScore = Math.max(-100, Math.min(100, currentScore + change));
  return { newScore, change };
}

/**
 * Daily reputation drift: extreme scores slowly regress toward 0.
 */
export function dailyReputationDrift(currentScore: number): number {
  if (Math.abs(currentScore) <= 10) return currentScore;
  const drift = currentScore > 0 ? -0.5 : 0.5;
  return parseFloat((currentScore + drift).toFixed(1));
}

/**
 * Check if reputation gates an opportunity.
 */
export function meetsReputationRequirement(score: number, requiredTier: ReputationTier): boolean {
  const tierOrder: ReputationTier[] = ["toxic", "controversial", "neutral", "respected", "beloved", "iconic"];
  const currentTier = getTier(score);
  return tierOrder.indexOf(currentTier) >= tierOrder.indexOf(requiredTier);
}
