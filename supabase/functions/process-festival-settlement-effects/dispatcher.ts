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
  const authority = authorities[effect.effect_type as FestivalEffectType];
  if (!authority) throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING", `No canonical authority for ${effect.effect_type}`);
  const { data, error } = await client.rpc(authority, {
    p_effect_id: effect.id, p_settlement_id: effect.settlement_id, p_outcome_id: effect.outcome_id,
    p_subject_type: effect.subject_type, p_subject_id: effect.subject_id,
    p_stable_reference: effect.stable_reference, p_requested_payload: effect.requested_payload,
  });
  if (error) throw new FestivalEffectError(error.code ?? "FESTIVAL_EFFECT_AUTHORITY_FAILED", error.message, true);
  const result = data as Partial<Applied & NotApplicable> | null;
  if (result?.status === "not_applicable" && typeof result.reason === "string") return { status: "not_applicable", reason: result.reason };
  if (result?.status !== "applied" || typeof result.canonicalId !== "string" || !result.canonicalId)
    throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_ID_MISSING", `${authority} did not return a canonical ID`, true);
  return { status: "applied", canonicalId: result.canonicalId, result: (result.result ?? {}) as Record<string, unknown> };
}

export function authorityFor(type: FestivalEffectType): string { return authorities[type]; }
