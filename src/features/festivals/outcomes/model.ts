export type FestivalCrowdState = "arriving" | "curious" | "attentive" | "engaged" | "singing" | "dancing" | "excited" | "ecstatic" | "restless" | "bored" | "leaving" | "fatigued" | "concerned" | "unsafe";
export type FestivalOutcomeStatus = "pending" | "calculating" | "calculated" | "finalised" | "invalidated" | "superseded" | "application_pending" | "applied";
export type FestivalAudienceGeneration = { id: string; edition_id: string; config_version: string; estimated_demand: number; ticket_holders: number; actual_arrivals: number; no_shows: number; source_facts?: Record<string, unknown> };
export type FestivalStageCrowdSnapshot = { id: string; edition_id: string; stage_id: string | null; session_id: string | null; snapshot_at: string; audience_total: number; capacity: number | null; density: number; satisfaction: number; excitement: number; fatigue: number; safety_pressure: number; crowd_state: FestivalCrowdState; cohort_distribution?: Record<string, number> };
export type FestivalPerformanceOutcome = { id: string; session_id: string; edition_id: string; festival_id: string; band_id: string; status: FestivalOutcomeStatus; model_version: string; config_version: string; overall_score: number; technical_score: number; musicianship_score: number; setlist_score: number; crowd_connection_score: number; professionalism_score: number; readiness_score: number; reliability_score: number; calculated_at: string; metadata?: Record<string, unknown> };
export type FestivalSongPerformanceOutcome = { id: string; outcome_id: string; session_id: string; setlist_position: number; song_id: string | null; status: string; performance_quality: number; crowd_response: number; audience_retained: number; audience_gained: number; audience_lost: number; highlight_status: string };
export type FestivalPerformanceHighlight = { id: string; session_id: string; outcome_id?: string | null; setlist_position?: number | null; highlight_type: string; is_positive: boolean; intensity: number; public_description: string; viewer_presentation_metadata?: Record<string, unknown> };
export type FestivalPerformanceEffect = { id: string; outcome_id: string; entity_type: string; entity_id: string | null; effect_type: string; proposed_value: number; explanation: string; application_status: FestivalOutcomeStatus };

export const FESTIVAL_OUTCOME_QUERY_KEYS = {
  editionAudience: (editionId: string) => ["festival-outcomes", "edition-audience", editionId] as const,
  stageCrowd: (editionId: string) => ["festival-outcomes", "stage-crowd", editionId] as const,
  sessionAudience: (sessionId: string) => ["festival-outcomes", "session-audience", sessionId] as const,
  performanceOutcome: (sessionId: string) => ["festival-outcomes", "performance", sessionId] as const,
  songOutcomes: (sessionId: string) => ["festival-outcomes", "songs", sessionId] as const,
  effects: (outcomeId: string) => ["festival-outcomes", "effects", outcomeId] as const,
  highlights: (sessionId: string) => ["festival-outcomes", "highlights", sessionId] as const,
  narrative: (sessionId: string) => ["festival-outcomes", "narrative", sessionId] as const,
  organiserDashboard: (editionId: string) => ["festival-outcomes", "organiser-dashboard", editionId] as const,
  publicOutcomes: (editionId: string) => ["festival-outcomes", "public", editionId] as const,
};

export function clampScore(value: number): number { return Math.min(100, Math.max(0, Math.round(value * 100) / 100)); }
export function crowdStateForScore(score: number): FestivalCrowdState { if (score >= 90) return "ecstatic"; if (score >= 78) return "excited"; if (score >= 65) return "engaged"; if (score >= 50) return "attentive"; if (score >= 35) return "restless"; return "bored"; }
export function reconcileCohortTotal(cohorts: Record<string, number>): number { return Object.values(cohorts).reduce((sum, value) => sum + Math.max(0, Math.floor(value)), 0); }
export function enforceStageCapacity(audience: number, capacity?: number | null): { audience: number; overcrowded: boolean } { const safeCapacity = Math.max(0, capacity ?? audience); return { audience: Math.min(Math.max(0, audience), safeCapacity), overcrowded: audience > safeCapacity }; }
export function scoreReadiness(status?: string): number { if (status === "excellent") return 95; if (status === "ready") return 82; if (status === "strained") return 65; if (status === "compromised") return 48; if (status === "blocked" || status === "unfit") return 25; return 72; }
export function calculateSongScore(input: { readinessScore: number; crowdFit: number; baseSkill: number; incidentPenalty?: number; pacingBonus?: number; variation?: number; skipped?: boolean }): number { if (input.skipped) return clampScore(input.baseSkill * 0.25); return clampScore(input.readinessScore * 0.3 + input.crowdFit * 0.25 + input.baseSkill * 0.35 + (input.pacingBonus ?? 0) + (input.variation ?? 0) - (input.incidentPenalty ?? 0)); }
export function aggregatePerformanceScore(songScores: number[], readinessScore: number, incidentPenalty: number, completionModifier: number): number { const songAverage = songScores.length ? songScores.reduce((sum, value) => sum + value, 0) / songScores.length : 45; return clampScore((songAverage * 0.62 + readinessScore * 0.28 + 70 * 0.1 - incidentPenalty) * completionModifier); }
export function fanConversionEstimate(audience: number, overallScore: number) { return { newCasualFans: Math.max(0, Math.round(audience * Math.max(0, overallScore - 55) / 1000)), newEngagedFans: Math.max(0, Math.round(audience * Math.max(0, overallScore - 70) / 1500)), newDedicatedFans: Math.max(0, Math.round(audience * Math.max(0, overallScore - 88) / 2500)), lostFans: Math.max(0, Math.round(audience * Math.max(0, 45 - overallScore) / 1000)) }; }
export function publicOutcomeIsPrivateSafe(row: Record<string, unknown>): boolean { return !["calculation_seed", "input_hash", "health_snapshot", "crew_snapshot", "equipment_snapshot", "contract_terms", "settlement_effects"].some((key) => key in row); }
