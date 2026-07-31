import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchFestivalEffect, FestivalEffectError, type Effect } from "./dispatcher.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || supplied !== serviceKey) return json({ error: "service_role_required" }, 401);
  const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, { auth: { persistSession: false } });
  const input = await request.json().catch(() => ({})) as { batchSize?: number };
  const limit = Math.min(Math.max(input.batchSize ?? 25, 1), 100);
  let processed = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const { data: effect, error: claimError } = await client.rpc("claim_next_festival_settlement_effect", {
      p_settlement_id: null, p_worker_identity: "process-festival-settlement-effects", p_expected_settlement_version: null, p_lease_seconds: 90,
    });
    if (claimError) return json({ error: claimError.message, processed, failed }, 500);
    if (!effect) break;
    const claimed = effect as Effect;
    try {
      const result = await dispatchFestivalEffect(client, claimed);
      const { error: acknowledgementError } = await client.rpc("acknowledge_festival_settlement_effect", {
        p_effect_id: claimed.id, p_claim_token: claimed.claim_token, p_status: result.status,
        p_applied_result: result.status === "applied" ? result.result : { reason: result.reason },
        p_canonical_id: result.status === "applied" ? result.canonicalId : null,
      });
      if (acknowledgementError) throw new FestivalEffectError("FESTIVAL_EFFECT_ACKNOWLEDGEMENT_FAILED", acknowledgementError.message, true);
      processed++;
    } catch (cause) {
      const error = cause instanceof FestivalEffectError ? cause : new FestivalEffectError("FESTIVAL_EFFECT_WORKER_FAILED", String(cause), true);
      const { error: acknowledgementError } = await client.rpc("acknowledge_festival_settlement_effect", {
        p_effect_id: claimed.id, p_claim_token: claimed.claim_token,
        p_status: error.recoverable ? "recovery_required" : "failed", p_applied_result: null,
        p_canonical_id: null, p_failure_code: error.code, p_failure_details: { message: error.message },
      });
      // Do not acknowledge an acknowledgement failure a second time. The live
      // lease remains reclaimable and canonical authority replay is idempotent.
      if (acknowledgementError) return json({ error: acknowledgementError.message, processed, failed }, 503);
      failed++;
    }
  }
  await client.rpc("finalise_ready_festival_settlement_effects", { p_limit: limit });
  return json({ processed, failed, boundedBy: limit });
});
