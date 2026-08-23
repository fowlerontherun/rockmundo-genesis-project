import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server configuration unavailable" }, 500);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Authentication required" }, 401);

    const body = await req.json().catch(() => ({}));
    const clubId = typeof body.clubId === "string" ? body.clubId : null;
    const actionType = typeof body.actionType === "string" ? body.actionType : null;
    if (!clubId || !actionType) return json({ error: "clubId and actionType are required" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (actionType === "policy") {
      const { data, error } = await admin.rpc("get_authoritative_nightclub_policy", {
        p_user_id: authData.user.id,
        p_nightclub_id: clubId,
      });
      if (error) throw error;
      return json(data);
    }

    if (actionType !== "stance" && actionType !== "drink") {
      return json({ error: "Unsupported nightclub action" }, 400);
    }

    const stance = actionType === "stance" && typeof body.stance === "string" ? body.stance : null;
    const drinkId = actionType === "drink" && typeof body.drinkId === "string" ? body.drinkId : null;
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : null;
    if (!idempotencyKey) return json({ error: "idempotencyKey is required" }, 400);

    const { data, error } = await admin.rpc("perform_authoritative_nightclub_action", {
      p_user_id: authData.user.id,
      p_nightclub_id: clubId,
      p_action_type: actionType,
      p_stance: stance,
      p_drink_id: drinkId,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    return json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nightclub action failed";
    console.error("nightclub-session", error);
    return json({ error: message }, 400);
  }
});
