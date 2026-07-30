export const FESTIVAL_EFFECT_TYPES = [
  "performance_result", "band_fans", "band_fame", "member_xp",
  "band_chemistry", "song_familiarity", "song_popularity",
  "festival_company_reputation", "festival_company_fame",
  "artist_relationship", "sponsor_relationship", "achievement_award",
  "licence_progress", "world_event", "notification", "tax_projection",
] as const;

export type FestivalEffectType = typeof FESTIVAL_EFFECT_TYPES[number];
export type Effect = {
  id: string; effect_type: string; subject_type: string; subject_id: string;
  stable_reference: string; requested_payload: Record<string, unknown>;
  required: boolean; claim_token: string;
};
export type Applied = { status: "applied"; canonicalId: string; result: Record<string, unknown> };
export type NotApplicable = { status: "not_applicable"; reason: string };
export type DispatchResult = Applied | NotApplicable;
export type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export class FestivalEffectError extends Error {
  constructor(public code: string, message: string, public recoverable = true) { super(message); }
}

export function stablePerformanceReference(sessionId: string, type: FestivalEffectType, subjectId: string) {
  if (!sessionId || !subjectId) throw new FestivalEffectError("FESTIVAL_EFFECT_SUBJECT_INVALID", "Missing performance session or subject", false);
  return `festival-performance:${sessionId}:${type}:${subjectId}`;
}

/**
 * All mutation is deliberately behind one SECURITY DEFINER database authority.
 * The dispatcher is an explicit allow-list, not a generic table mutation API.
 */
export async function dispatchFestivalEffect(effect: Effect, rpc: Rpc): Promise<DispatchResult> {
  if (!FESTIVAL_EFFECT_TYPES.includes(effect.effect_type as FestivalEffectType)) {
    throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_AUTHORITY_MISSING", `No authority for ${effect.effect_type}`, false);
  }
  if (!effect.id || !effect.subject_id || !effect.stable_reference || !effect.claim_token) {
    throw new FestivalEffectError("FESTIVAL_EFFECT_SUBJECT_INVALID", "The claimed effect is incomplete", false);
  }
  const { data, error } = await rpc("apply_festival_settlement_effect_authority", {
    p_effect_id: effect.id, p_claim_token: effect.claim_token,
  });
  if (error) throw new FestivalEffectError("FESTIVAL_EFFECT_AUTHORITY_FAILED", error.message);
  const result = data as { status?: string; canonicalId?: string; result?: Record<string, unknown>; reason?: string } | null;
  if (result?.status === "not_applicable" && result.reason) return { status: "not_applicable", reason: result.reason };
  if (result?.status !== "applied" || !result.canonicalId) {
    throw new FestivalEffectError("FESTIVAL_EFFECT_CANONICAL_ID_MISSING", "Authority did not return a canonical ID");
  }
  return { status: "applied", canonicalId: result.canonicalId, result: result.result ?? {} };
}
