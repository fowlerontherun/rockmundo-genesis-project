// Authenticated cooking gateway: the browser never receives the service-role key.
// Recipes remain inactive until the complete economy and live UX have been tested.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isSlug = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9_-]{1,100}$/.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if ((Number(request.headers.get("content-length")) || 0) > 4096) {
    return json({ error: "request_too_large" }, 413);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return json({ error: "authentication_required" }, 401);
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !serviceKey) return json({ error: "service_unavailable" }, 503);

  const token = authorization.replace(/^Bearer\s+/i, "");
  const publicClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: identity, error: authError } = await publicClient.auth.getUser(token);
  if (authError || !identity.user || identity.user.is_anonymous) {
    return json({ error: "authentication_required" }, 401);
  }

  const { data: profile, error: profileError } = await publicClient
    .from("profiles").select("id")
    .eq("user_id", identity.user.id)
    .eq("is_active", true)
    .is("died_at", null)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (profileError) return json({ error: "character_unavailable" }, 503);
  if (!profile) return json({ error: "active_character_required" }, 403);

  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "request_too_large" }, 413);
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json({ error: "invalid_request" }, 400);
    }
    payload = data as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  // During rollout the profile claim is optional for older installed clients,
  // but when supplied it MUST match the server-selected current character.
  // A browser-provided profile ID is never used as the source of authority.
  if (payload.profileId !== undefined &&
      (!isUuid(payload.profileId) || payload.profileId !== profile.id)) {
    return json({ error: "active_character_mismatch" }, 403);
  }
  const action = payload.action;
  const sessionId = payload.sessionId;
  if (!isUuid(sessionId) || !["start", "status", "heat", "add", "remove", "finish"].includes(String(action))) {
    return json({ error: "invalid_cooking_request" }, 400);
  }

  // Only a freshly verified active character is eligible for privileged RPCs.
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const profileId = profile.id;

  try {
    if (action === "start") {
      if (!isSlug(payload.recipeSlug)) return json({ error: "invalid_recipe" }, 400);
      // This operation is idempotent and deducts stock exactly once.
      const { data, error } = await admin.rpc("begin_cooking_session", {
        _profile_id: profileId, _recipe_slug: payload.recipeSlug, _session_id: sessionId,
      });
      if (error) return json({ error: "cooking_start_rejected", detail: error.message }, 409);
      return json({ sessionId: data, status: "pending" });
    }

    // Check ownership using the user-scoped client before privileged actions.
    // No profileId supplied by a browser is trusted.
    const { data: session, error: sessionError } = await publicClient
      .from("cooking_sessions")
      .select("id,status,mode,recipe_slug,started_at,expires_at,finished_at,execution_score,result_batch_id")
      .eq("id", sessionId).eq("profile_id", profileId).maybeSingle();
    if (sessionError) return json({ error: "session_lookup_failed" }, 503);
    if (!session) return json({ error: "session_not_found" }, 404);

    if (action === "status") {
      const { data: actions, error } = await publicClient
        .from("cooking_session_actions")
        .select("action_sequence,action_type,ingredient_slug,heat,recorded_at")
        .eq("session_id", sessionId).order("action_sequence", { ascending: true })
        .limit(257);
      if (error) return json({ error: "session_actions_unavailable" }, 503);
      // A server wall-clock anchor lets reconnecting clients render the
      // remaining cooking time correctly even when their device clock is off.
      return json({ session, actions, serverNow: new Date().toISOString() });
    }

    if (action === "finish") {
      const { data, error } = await admin.rpc("finalize_manual_cooking", {
        _session_id: sessionId,
      });
      if (error) return json({ error: "cooking_finish_rejected", detail: error.message }, 409);
      return json(data);
    }

    if (action === "heat" && !["off", "low", "medium", "high"].includes(String(payload.heat))) {
      return json({ error: "invalid_heat" }, 400);
    }
    if ((action === "add" || action === "remove") && !isSlug(payload.ingredientSlug)) {
      return json({ error: "invalid_ingredient" }, 400);
    }
    const { data, error } = await admin.rpc("record_cooking_action", {
      _session_id: sessionId,
      _action_type: action,
      _ingredient_slug: action === "heat" ? null : payload.ingredientSlug,
      _heat: action === "heat" ? payload.heat : null,
    });
    if (error) return json({ error: "cooking_action_rejected", detail: error.message }, 409);
    return json({ accepted: true, actionId: data });
  } catch (error) {
    console.error("Cooking gateway request failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "cooking_service_unavailable" }, 500);
  }
});
