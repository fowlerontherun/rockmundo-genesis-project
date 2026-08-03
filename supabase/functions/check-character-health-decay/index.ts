import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) =>
  console.log(`[HEALTH-DECAY] ${step}${details ? ` — ${JSON.stringify(details)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    log("Starting daily health decay check");

    // Offline players are never punished for time away. Health changes are
    // driven by gameplay activities and conditions, not by login frequency.
    const { data: staleProfiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, user_id, health, last_login_at, display_name, username, avatar_url, bio, fame, cash, age, experience, level, generation_number, is_active, died_at, resurrection_lives")
      .is("died_at", null)
      .eq("is_active", true)
      .lt("last_login_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (fetchError) {
      log("Error fetching stale profiles", fetchError);
      throw fetchError;
    }

    if (!staleProfiles || staleProfiles.length === 0) {
      log("No stale profiles found");
      return new Response(JSON.stringify({ processed: 0, skipped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`Skipped offline health decay for ${staleProfiles.length} profiles`);
    return new Response(JSON.stringify({ processed: 0, deaths: 0, skipped: staleProfiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
