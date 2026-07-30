import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchFestivalEffect, FestivalEffectError, type Effect } from "./dispatcher.ts";

const MAX_EFFECTS = 25;
const MAX_RUNTIME_MS = 45_000;

Deno.serve(async (request) => {
  const secret = Deno.env.get("FESTIVAL_EFFECT_WORKER_SECRET");
  if (!secret || request.headers.get("x-worker-secret") !== secret) return new Response("unauthorised", { status: 401 });
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const started = Date.now();
  let processed = 0;
  while (processed < MAX_EFFECTS && Date.now() - started < MAX_RUNTIME_MS) {
    const { data, error } = await client.rpc("claim_next_festival_settlement_effect", { p_lease_seconds: 90 });
    if (error) return Response.json({ processed, error: error.message }, { status: 500 });
    const effect = (Array.isArray(data) ? data[0] : data) as Effect | null;
    if (!effect?.id) break;
    try {
      const result = await dispatchFestivalEffect(effect, (name, args) => client.rpc(name, args));
      const ack = await client.rpc("acknowledge_festival_settlement_effect", {
        p_effect_id: effect.id, p_claim_token: effect.claim_token, p_status: result.status,
        p_canonical_id: result.status === "applied" ? result.canonicalId : null,
        p_applied_result: result.status === "applied" ? result.result : { reason: result.reason },
      });
      if (ack.error) throw new FestivalEffectError("FESTIVAL_EFFECT_ACK_FAILED", ack.error.message);
    } catch (cause) {
      const failure = cause instanceof FestivalEffectError ? cause : new FestivalEffectError("FESTIVAL_EFFECT_UNEXPECTED", String(cause));
      await client.rpc("fail_festival_settlement_effect", { p_effect_id: effect.id, p_claim_token: effect.claim_token,
        p_error_code: failure.code, p_error_details: { message: failure.message }, p_recoverable: failure.recoverable });
    }
    processed++;
  }
  await client.rpc("finalise_ready_festival_settlement_effects");
  return Response.json({ processed });
});
