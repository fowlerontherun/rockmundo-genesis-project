/**
 * Band Morale System (v1.0.931)
 * Morale is a 0-100 score affected by events, pay, drama, wins, and rider fulfillment.
 * Low morale reduces performance quality; high morale gives bonuses.
 */

export interface MoraleState {
  score: number;         // 0-100
  level: "miserable" | "low" | "okay" | "good" | "excellent" | "euphoric";
  performanceModifier: number;  // 0.7 – 1.2
  creativityModifier: number;   // 0.8 – 1.15
  dramaRisk: number;            // 0 – 0.3 (chance of drama event)
  leaveRisk: number;            // 0 – 0.2 (chance member considers leaving)
}

// Events that shift morale
export const MORALE_EVENTS: Record<string, number> = {
  // Positive
  gig_great_performance: 8,
  award_win: 15,
  chart_top_10: 10,
  rider_fully_met: 5,
  salary_paid: 3,
  bonus_paid: 7,
  new_song_released: 4,
  fan_milestone: 6,
  vacation_day: 4,
  collaboration_success: 5,

  // Negative
  gig_bad_performance: -10,
  salary_missed: -15,
  drama_event: -8,
  member_conflict: -12,
  rider_not_met: -5,
  cancelled_gig: -7,
  negative_press: -6,
  arrest: -20,
  exhaustion: -8,
  equipment_failure: -4,
};

function getMoraleLevel(score: number): MoraleState["level"] {
  if (score <= 15) return "miserable";
  if (score <= 30) return "low";
  if (score <= 50) return "okay";
  if (score <= 70) return "good";
  if (score <= 90) return "excellent";
  return "euphoric";
}

/**
 * Get full morale state from a raw score.
 */
export function getMoraleState(score: number): MoraleState {
  const clamped = Math.max(0, Math.min(100, score));
  const level = getMoraleLevel(clamped);

  // Performance modifier: 0.7 at 0 morale, 1.0 at 50, 1.2 at 100
  const performanceModifier = parseFloat((0.7 + (clamped / 100) * 0.5).toFixed(2));

  // Creativity: 0.8 at 0, 1.0 at 50, 1.15 at 100
  const creativityModifier = parseFloat((0.8 + (clamped / 100) * 0.35).toFixed(2));

  // Drama risk: high when morale is low
  const dramaRisk = clamped <= 30
    ? parseFloat((0.3 - (clamped / 30) * 0.25).toFixed(2))
    : clamped <= 50 ? 0.05 : 0;

  // Leave risk: only when morale is very low
  const leaveRisk = clamped <= 20
    ? parseFloat((0.2 - (clamped / 20) * 0.18).toFixed(2))
    : 0;

  return { score: clamped, level, performanceModifier, creativityModifier, dramaRisk, leaveRisk };
}

/**
 * Apply a morale event and return the new score.
 */
export function applyMoraleEvent(currentScore: number, eventKey: string): { newScore: number; change: number } {
  const change = MORALE_EVENTS[eventKey] ?? 0;
  const newScore = Math.max(0, Math.min(100, currentScore + change));
  return { newScore, change };
}

/**
 * Daily morale drift: extreme scores drift toward 50 (baseline).
 */
export function dailyMoraleDrift(currentScore: number): number {
  const baseline = 50;
  if (Math.abs(currentScore - baseline) <= 2) return currentScore;
  const drift = currentScore > baseline ? -1 : 1;
  return Math.max(0, Math.min(100, currentScore + drift));
}

/**
 * Calculate band-wide morale from individual member morales.
 */
export function calculateBandMorale(memberMorales: number[]): number {
  if (memberMorales.length === 0) return 50;
  const avg = memberMorales.reduce((s, m) => s + m, 0) / memberMorales.length;
  // Lowest member drags down the average slightly
  const lowest = Math.min(...memberMorales);
  const weighted = avg * 0.7 + lowest * 0.3;
  return Math.round(weighted);
}
