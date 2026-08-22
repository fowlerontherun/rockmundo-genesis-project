import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BuskingRequest =
  | { action: "options" }
  | {
      action: "start";
      locationId: string;
      duration: 30 | 60 | 120;
      idempotencyKey: string;
    };

type BuskingResult = {
  sessionId: string;
  profileId: string;
  cityId: string;
  cityName: string;
  locationId: string;
  locationName: string;
  duration: 30 | 60 | 120;
  xpGained: number;
  cashEarned: number;
  licenceFee: number;
  netCashChange: number;
  startedAt: string;
  endsAt: string;
  performanceRoll: number;
  performanceDescriptor: string;
  cityDemandMultiplier: number;
  idempotent?: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("[busking-session] Supabase environment is incomplete");
      return json({ error: "Busking service is unavailable" }, 503);
    }

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) {
      console.warn("[busking-session] Invalid caller token", authError?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = authData.user.id;
    const body = (await req.json()) as BuskingRequest;

    if (body.action === "options") {
      const { data, error } = await service.rpc("get_authoritative_busking_options", {
        p_user_id: userId,
      });
      if (error) {
        console.error("[busking-session] options RPC failed", error);
        return json({ error: error.message || "Unable to load busking options" }, 400);
      }
      return json({ success: true, options: data });
    }

    if (body.action !== "start") {
      return json({ error: "Unknown busking action" }, 400);
    }

    if (!body.locationId || ![30, 60, 120].includes(Number(body.duration))) {
      return json({ error: "Invalid busking location or duration" }, 400);
    }

    if (!body.idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey)) {
      return json({ error: "A valid idempotency key is required" }, 400);
    }

    const { data: resultData, error: resultError } = await service.rpc(
      "perform_authoritative_busking",
      {
        p_user_id: userId,
        p_location_key: body.locationId,
        p_duration_minutes: Number(body.duration),
        p_idempotency_key: body.idempotencyKey,
      },
    );

    if (resultError) {
      console.error("[busking-session] authoritative session failed", resultError);
      const knownMessage = resultError.message || "Unable to start busking";
      const status = knownMessage.includes("insufficient_funds") ? 402 : 409;
      return json({ error: knownMessage }, status);
    }

    const result = resultData as BuskingResult;
    if (!result?.sessionId || !result?.profileId || !Number.isFinite(result?.xpGained)) {
      console.error("[busking-session] malformed busking result", resultData);
      return json({ error: "Busking result could not be prepared" }, 500);
    }

    // XP remains owned by RockMundo's canonical progression authority. The session
    // id is the unique event key, so retries can repair an interrupted XP award
    // without ever awarding it twice.
    const uniqueEventId = `busking:${result.sessionId}`;
    const { error: xpError } = await service.rpc("progression_award_action_xp", {
      p_profile_id: result.profileId,
      p_amount: Math.max(1, Math.round(result.xpGained)),
      p_category: "performance",
      p_action_key: "busking_session",
      p_metadata: {
        unique_event_id: uniqueEventId,
        source: "authoritative_busking",
        busking_session_id: result.sessionId,
        city_id: result.cityId,
        location_id: result.locationId,
        duration_minutes: result.duration,
        cash_earned: result.cashEarned,
        licence_fee: result.licenceFee,
        performance_roll: result.performanceRoll,
      },
    });

    if (xpError) {
      const duplicate = /duplicate progression event/i.test(xpError.message || "");
      if (!duplicate) {
        console.error("[busking-session] progression award failed", xpError);
        return json(
          {
            error: "Busking was recorded, but XP could not be finalised. Retry the same session request.",
            retryable: true,
            sessionId: result.sessionId,
          },
          503,
        );
      }
    }

    return json({ success: true, result: { ...result, xpAwarded: true } });
  } catch (error) {
    console.error("[busking-session] unhandled error", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected busking error" },
      500,
    );
  }
});
