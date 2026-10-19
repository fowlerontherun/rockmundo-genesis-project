import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (payload: unknown, status: number) =>
  new Response(JSON.stringify(payload), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Internal scheduler-only adapter. The service-role JWT is never supplied by
 * players; all game state changes now happen inside the single locked RPC.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Authenticate before initializing a privileged client or reading an ID.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization") ?? "";
  if (!serviceKey || authorization !== `Bearer ${serviceKey}`) {
    return json({ error: "Scheduler authorization required" }, 403);
  }

  let activityId: unknown;
  try {
    const input = await req.json();
    activityId = input?.activityId;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (typeof activityId !== "string" ||
      !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(activityId)) {
    return json({ error: "Valid activityId is required" }, 400);
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
  );
  const { data, error } = await client.rpc("settle_self_promotion_atomic", {
    p_activity_id: activityId,
  });
  if (error) {
    console.error("[process-self-promotion] Atomic settlement failed:", error.code);
    return json({ error: "Promotion settlement could not be completed" }, 500);
  }

  const result = data as {
    settled?: boolean;
    reason?: string;
    fame_gained?: number;
    fans_gained?: number;
    new_total_fame?: number;
    new_total_fans?: number;
    cooldown_expires_at?: string;
  } | null;
  if (result?.settled === true) {
    return json({
      success: true, activityId, fameGained: result.fame_gained,
      fansGained: result.fans_gained, newTotalFame: result.new_total_fame,
      newTotalFans: result.new_total_fans,
      cooldownExpiresAt: result.cooldown_expires_at,
    }, 200);
  }
  if (result?.reason === "already_completed") {
    return json({ success: true, alreadyCompleted: true, activityId }, 200);
  }
  return json({ success: false, reason: result?.reason ?? "not_processed" }, 409);
});
