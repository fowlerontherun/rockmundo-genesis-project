export type RelationshipDimension = "familiarity" | "trust" | "creative_chemistry" | "performance_chemistry" | "reliability_confidence" | "social_rapport" | "conflict";
export type RelationshipLevel = "strangers" | "acquaintances" | "familiar" | "reliable_collaborators" | "trusted_partners" | "strong_chemistry" | "exceptional_partnership";
export type ActivityKind = "rehearsal" | "jam_session" | "songwriting" | "recording" | "gig" | "tour" | "agreement" | "governance" | "band_meeting" | "social";
export type AttendanceOutcome = "attended_on_time" | "attended_late" | "excused_absence" | "unexcused_absence" | "cancelled_in_advance" | "failed_to_attend" | "left_early" | "participated_fully" | "participated_poorly";

export interface RelationshipValues { familiarity: number; trust: number; creative_chemistry: number; performance_chemistry: number; reliability_confidence: number; social_rapport: number; conflict: number; }
export interface RelationshipRecord extends RelationshipValues { player_low_id: string; player_high_id: string; relationship_level: RelationshipLevel; }
export interface RelationshipEventInput { playerAId: string; playerBId: string; eventType: string; sourceType: ActivityKind | string; sourceId: string; impact?: Partial<RelationshipValues>; occurredAt?: Date; metadata?: Record<string, unknown>; }
export interface RelationshipEventResult { relationship: RelationshipRecord; idempotencyKey: string; changed: boolean; }

export const RELATIONSHIP_IMPACTS: Record<string, Partial<RelationshipValues>> = {
  rehearsal_completed: { familiarity: 2, performance_chemistry: 3, trust: 1 },
  jam_completed: { familiarity: 2, creative_chemistry: 3, social_rapport: 1 },
  songwriting_completed: { familiarity: 2, creative_chemistry: 4, trust: 1 },
  recording_completed: { familiarity: 1, creative_chemistry: 2, performance_chemistry: 2, trust: 2, reliability_confidence: 2 },
  gig_completed: { familiarity: 2, performance_chemistry: 4, trust: 2 },
  tour_date_completed: { familiarity: 3, performance_chemistry: 4, trust: 3, reliability_confidence: 2 },
  excused_absence: { reliability_confidence: -1 },
  unexcused_absence: { trust: -5, reliability_confidence: -7, conflict: 3 },
  late_cancellation: { trust: -3, reliability_confidence: -4, conflict: 2 },
  missed_gig_no_notice: { trust: -8, reliability_confidence: -12, conflict: 6 },
  agreement_honoured: { trust: 3, reliability_confidence: 2 },
  agreement_dispute: { trust: -6, conflict: 5 },
  governance_disagreement: { familiarity: 1 },
  governance_respectful_compromise: { social_rapport: 2, conflict: -2 },
  conflict_resolved: { trust: 2, social_rapport: 2, conflict: -8 },
};

export const RELATIONSHIP_CAPS = { dailyPositiveGainCap: 12, weeklyPositiveGainCap: 30, repeatWindowDays: 7, repeatLowValueMultiplier: 0.35, modifiers: { rehearsalEfficiency: 0.10, performanceConsistency: 0.08, recordingEfficiency: 0.08, songwritingCollaboration: 0.10, tourStressResistance: 0.10 } } as const;

export function canonicalPair(a: string, b: string): [string, string] { if (a === b) throw new Error("A relationship requires two distinct players."); return a < b ? [a, b] : [b, a]; }
export function clampRelationshipValue(value: number) { return Math.max(0, Math.min(100, Math.round(value * 100) / 100)); }
export function makeRelationshipIdempotencyKey(input: Pick<RelationshipEventInput, "sourceType" | "sourceId" | "eventType">) { return `${input.sourceType}:${input.sourceId}:${input.eventType}`; }

export function applyDiminishingReturns(impact: Partial<RelationshipValues>, current: RelationshipValues, repeatedSimilarEvents = 0): Partial<RelationshipValues> {
  const repeatMultiplier = repeatedSimilarEvents <= 0 ? 1 : Math.max(RELATIONSHIP_CAPS.repeatLowValueMultiplier, 1 / (1 + repeatedSimilarEvents * 0.5));
  return Object.fromEntries(Object.entries(impact).map(([key, raw]) => {
    const dim = key as RelationshipDimension; const value = Number(raw ?? 0); if (value <= 0) return [key, value];
    const highValueMultiplier = dim === "familiarity" ? Math.max(0.25, 1 - current[dim] / 140) : Math.max(0.4, 1 - current[dim] / 180);
    return [key, Math.round(value * repeatMultiplier * highValueMultiplier * 100) / 100];
  })) as Partial<RelationshipValues>;
}

export function deriveRelationshipLevel(v: RelationshipValues): RelationshipLevel {
  const score = v.familiarity * 0.18 + v.trust * 0.22 + v.creative_chemistry * 0.16 + v.performance_chemistry * 0.16 + v.reliability_confidence * 0.18 + v.social_rapport * 0.10 - v.conflict * 0.35;
  if (v.conflict >= 70 || v.trust < 25) return "strangers";
  if (score >= 88 && v.trust >= 75 && v.reliability_confidence >= 65 && v.conflict < 25) return "exceptional_partnership";
  if (score >= 75 && v.trust >= 65 && v.conflict < 35) return "strong_chemistry";
  if (score >= 62 && v.trust >= 60 && v.reliability_confidence >= 55 && v.conflict < 45) return "trusted_partners";
  if (score >= 50 && v.reliability_confidence >= 50 && v.conflict < 55) return "reliable_collaborators";
  if (score >= 35) return "familiar"; if (score >= 20) return "acquaintances"; return "strangers";
}

export function applyRelationshipEvent(record: RelationshipRecord | null, input: RelationshipEventInput, repeatedSimilarEvents = 0): RelationshipEventResult {
  const [low, high] = canonicalPair(input.playerAId, input.playerBId);
  const base: RelationshipRecord = record ?? { player_low_id: low, player_high_id: high, familiarity: 0, trust: 50, creative_chemistry: 0, performance_chemistry: 0, reliability_confidence: 50, social_rapport: 0, conflict: 0, relationship_level: "strangers" };
  const impact = applyDiminishingReturns(input.impact ?? RELATIONSHIP_IMPACTS[input.eventType] ?? {}, base, repeatedSimilarEvents);
  const nextValues: RelationshipValues = { familiarity: clampRelationshipValue(base.familiarity + (impact.familiarity ?? 0)), trust: clampRelationshipValue(base.trust + (impact.trust ?? 0)), creative_chemistry: clampRelationshipValue(base.creative_chemistry + (impact.creative_chemistry ?? 0)), performance_chemistry: clampRelationshipValue(base.performance_chemistry + (impact.performance_chemistry ?? 0)), reliability_confidence: clampRelationshipValue(base.reliability_confidence + (impact.reliability_confidence ?? 0)), social_rapport: clampRelationshipValue(base.social_rapport + (impact.social_rapport ?? 0)), conflict: clampRelationshipValue(base.conflict + (impact.conflict ?? 0)) };
  return { relationship: { ...base, ...nextValues, relationship_level: deriveRelationshipLevel(nextValues) }, idempotencyKey: makeRelationshipIdempotencyKey(input), changed: Object.values(impact).some((v) => v !== 0) };
}

export function calculateBandCohesion(relationships: RelationshipValues[], memberCount: number) {
  if (memberCount < 2 || relationships.length === 0) return { cohesion: 50, creativeSync: 0, liveSync: 0, trust: 50, reliability: 50, conflict: 0, trend: "new_lineup" as const };
  const strengths = relationships.map((r) => r.familiarity * 0.12 + r.trust * 0.24 + r.creative_chemistry * 0.16 + r.performance_chemistry * 0.18 + r.reliability_confidence * 0.20 + r.social_rapport * 0.10 - r.conflict * 0.30);
  const avg = strengths.reduce((a, b) => a + b, 0) / strengths.length; const weak = Math.min(...strengths);
  const conflict = relationships.reduce((a, r) => a + r.conflict, 0) / relationships.length;
  const cohesion = clampRelationshipValue(avg * 0.58 + weak * 0.27 + Math.min(100, memberCount * 12) * 0.05 + (memberCount <= 2 ? 6 : memberCount <= 5 ? 0 : -3) - conflict * 0.10);
  return { cohesion, creativeSync: clampRelationshipValue(relationships.reduce((a, r) => a + r.creative_chemistry, 0) / relationships.length), liveSync: clampRelationshipValue(relationships.reduce((a, r) => a + r.performance_chemistry, 0) / relationships.length), trust: clampRelationshipValue(relationships.reduce((a, r) => a + r.trust, 0) / relationships.length), reliability: clampRelationshipValue(relationships.reduce((a, r) => a + r.reliability_confidence, 0) / relationships.length), conflict: clampRelationshipValue(conflict), trend: "stable" as const };
}

export function resolveRelationshipEffects(values: RelationshipValues) {
  const positive = (values.trust + values.performance_chemistry + values.reliability_confidence) / 300; const pressure = values.conflict / 100;
  return { rehearsalEfficiency: boundedModifier((positive - pressure) * 0.16, RELATIONSHIP_CAPS.modifiers.rehearsalEfficiency), performanceConsistency: boundedModifier(((values.performance_chemistry + values.trust) / 200 - pressure) * 0.12, RELATIONSHIP_CAPS.modifiers.performanceConsistency), recordingEfficiency: boundedModifier(((values.creative_chemistry + values.reliability_confidence) / 200 - pressure) * 0.12, RELATIONSHIP_CAPS.modifiers.recordingEfficiency), songwritingCollaboration: boundedModifier(((values.creative_chemistry + values.social_rapport) / 200 - pressure) * 0.16, RELATIONSHIP_CAPS.modifiers.songwritingCollaboration), tourStressResistance: boundedModifier(((values.trust + values.reliability_confidence + values.social_rapport) / 300 - pressure) * 0.16, RELATIONSHIP_CAPS.modifiers.tourStressResistance) };
}
function boundedModifier(raw: number, cap: number) { return Math.round(Math.max(-cap, Math.min(cap, raw)) * 10000) / 10000; }
export function describePositiveBand(value: number) { return value >= 85 ? "Exceptional" : value >= 70 ? "Strong" : value >= 50 ? "Comfortable" : value >= 25 ? "Developing" : "Unfamiliar"; }
export function describeConflict(value: number) { return value >= 75 ? "Volatile" : value >= 50 ? "Strained" : value >= 25 ? "Tense" : "Calm"; }
