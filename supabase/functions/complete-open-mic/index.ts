import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  },
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Open Mic service configuration is incomplete");
    }
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "You must be signed in to complete an Open Mic");
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const token = authorization.slice("Bearer ".length);
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new HttpError(401, "Your session has expired. Please sign in again.");

    const body = await req.json();
    const performanceId = typeof body?.performanceId === "string" ? body.performanceId : null;
    if (!performanceId) throw new HttpError(400, "A valid Open Mic performance is required");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: performance, error: performanceError } = await admin
      .from("open_mic_performances")
      .select("id,user_id")
      .eq("id", performanceId)
      .maybeSingle();

    if (performanceError) throw performanceError;
    if (!performance) throw new HttpError(404, "Open Mic performance not found");
    if (performance.user_id !== user.id) throw new HttpError(403, "This is not your Open Mic performance");

    const { data: result, error: completionError } = await admin.rpc("complete_open_mic_atomic", {
      p_performance_id: performanceId,
      p_user_id: user.id,
    });

    if (completionError) {
      const message = completionError.message || "Open Mic completion failed";
      const status = message.includes("Both Open Mic songs") || message.includes("not currently live") ? 409 : 500;
      throw new HttpError(status, message);
    }

    console.log("Open Mic completed", { performanceId, alreadyCompleted: result?.already_completed });
    return jsonResponse({ success: true, ...result });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Open Mic completion failed";
    console.error("Error completing Open Mic", { status, message });
    return jsonResponse({ error: message }, status);
  }
});
