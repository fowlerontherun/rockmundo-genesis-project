export const EFFECT_TYPES = [
  "performance_result", "band_fans", "band_fame", "member_xp", "band_chemistry",
  "song_familiarity", "song_popularity", "festival_company_reputation",
  "festival_company_fame", "artist_relationship", "sponsor_relationship",
  "achievement_award", "licence_progress", "world_event", "notification", "tax_projection",
] as const;

export type FestivalEffectType = typeof EFFECT_TYPES[number];
export type Effect = {
  id: string; settlement_id: string; outcome_id: string; effect_type: string;
  subject_type: string; subject_id: string; stable_reference: string;
  requested_payload: Record<string, unknown>; claim_token: string; required?: boolean;
};
export type Applied = { status: "applied"; canonicalId: string; result: Record<string, unknown> };
export type NotApplicable = { status: "not_applicable"; reason: string };
export type DispatchResult = Applied | NotApplicable;
export type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string; code?: string } | null }> };

export class FestivalEffectError extends Error {
  constructor(public code: string, message: string, public recoverable = false) { super(message); }
}

const authorities: Record<FestivalEffectType, string> = {
  performance_result: "apply_festival_performance_result_effect",
  band_fans: "apply_festival_band_fans_effect",
  band_fame: "apply_festival_band_fame_effect",
  member_xp: "apply_festival_member_xp_effect",
  band_chemistry: "apply_festival_band_chemistry_effect",
  song_familiarity: "apply_festival_song_familiarity_effect",
  song_popularity: "apply_festival_song_popularity_effect",
  festival_company_reputation: "apply_festival_company_reputation_effect",
  festival_company_fame: "apply_festival_company_fame_effect",
  artist_relationship: "apply_festival_artist_relationship_effect",
  sponsor_relationship: "apply_festival_sponsor_relationship_effect",
  achievement_award: "apply_festival_achievement_effect",
  licence_progress: "apply_festival_licence_progress_effect",
  world_event: "apply_festival_world_event_effect",
  notification: "apply_festival_notification_effect",
  tax_projection: "apply_festival_tax_projection_effect",
};

export const SUPPORTED_EFFECT_TYPES = EFFECT_TYPES.slice(0, 7);
export const INCOMPLETE_EFFECT_TYPES = EFFECT_TYPES.slice(7);

const canonicalRecordTypes: Record<FestivalEffectType, string> = {
  performance_result: "performance_outcome", band_fans: "fan_event", band_fame: "fame_event",
  member_xp: "xp_transaction", band_chemistry: "contribution_event",
  song_familiarity: "song_progression_event", song_popularity: "song_popularity_event",
  festival_company_reputation: "company_reputation_event", festival_company_fame: "company_fame_event",
  artist_relationship: "artist_relationship_event", sponsor_relationship: "sponsor_relationship_event",
  achievement_award: "achievement_award", licence_progress: "licence_progress_record",
  world_event: "world_event", notification: "notification", tax_projection: "tax_projection",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function validateEffect(value: Effect): void {
  if (!value.id || !value.settlement_id || !value.outcome_id || !value.subject_id || !value.claim_token)
    throw new FestivalEffectError("FESTIVAL_EFFECT_INVALID_SUBJECT", "Effect identity is incomplete");
  if (!value.stable_reference || !value.stable_reference.startsWith("festival-"))
    throw new FestivalEffectError("FESTIVAL_EFFECT_INVALID_REFERENCE", "Stable reference is invalid");
  if (!value.requested_payload || Array.isArray(value.requested_payload))
    throw new FestivalEffectError("FESTIVAL_EFFECT_INVALID_PAYLOAD", "Requested payload must be an object");
}

export async function dispatchFestivalEffect(client: RpcClient, effect: Effect): Promise<DispatchResult> {
  validateEffect(effect);
  if (INCOMPLETE_EFFECT_TYPES.includes(effect.effect_type as FestivalEffectType)) {
    throw new FestivalEffectError(
      "FESTIVAL_EFFECT_IMPLEMENTATION_PENDING",
      `${effect.effect_type} is incomplete and explicitly fail-closed`,
      false,
    );
  }
  const authority = authorities[effect.effect_type as FestivalEffectType];
  if (!authority) throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING", `No canonical authority for ${effect.effect_type}`);
  const { data, error } = await client.rpc(authority, {
    p_effect_id: effect.id, p_settlement_id: effect.settlement_id, p_outcome_id: effect.outcome_id,
    p_subject_type: effect.subject_type, p_subject_id: effect.subject_id,
    p_stable_reference: effect.stable_reference, p_requested_payload: effect.requested_payload,
  });
  if (error) {
    const code = error.code ?? "FESTIVAL_EFFECT_AUTHORITY_FAILED";
    const permanent = /MISSING|MISMATCH|INVALID|NOT_FOUND|SUBJECT|NOT_PERFORMED|NOT_ATTENDING/.test(`${code}:${error.message}`.toUpperCase());
    throw new FestivalEffectError(code, error.message, !permanent);
  }
  const result = data as Partial<Applied & NotApplicable> | null;
  if (result?.status === "not_applicable" && typeof result.reason === "string") return { status: "not_applicable", reason: result.reason };
  if (result?.status !== "applied" || typeof result.canonicalId !== "string" || !result.canonicalId)
    throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_ID_MISSING", `${authority} did not return a canonical ID`, false);
  const applied = (result.result ?? {}) as Record<string, unknown>;
  const expectedType = canonicalRecordTypes[effect.effect_type as FestivalEffectType];
  if (applied.canonical_record_type !== expectedType || applied.stable_reference !== effect.stable_reference ||
      applied.subject_type !== effect.subject_type || String(applied.subject_id ?? "") !== effect.subject_id ||
      applied.canonical_record_id !== result.canonicalId || typeof applied.evidence_digest !== "string" ||
      applied.evidence_digest.length === 0 || applied.canonical_authority !== authority ||
      typeof applied.canonical_table_or_service !== "string" || !applied.canonical_table_or_service ||
      applied.canonical_table_or_service === "festival_effect_authority_results" ||
      !isRecord(applied.before_state) || !isRecord(applied.requested_change) ||
      canonicalJson(applied.requested_change) !== canonicalJson(effect.requested_payload) ||
      !isRecord(applied.validated_change) || !isRecord(applied.after_state) ||
      typeof applied.rules_version !== "string" || !applied.rules_version ||
      typeof applied.applied_at !== "string" || Number.isNaN(Date.parse(applied.applied_at))) {
    throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_RESULT_INVALID", `${authority} returned unverifiable canonical evidence`, false);
  }
  return { status: "applied", canonicalId: result.canonicalId, result: applied };
}

export function authorityFor(type: FestivalEffectType): string { return authorities[type]; }
