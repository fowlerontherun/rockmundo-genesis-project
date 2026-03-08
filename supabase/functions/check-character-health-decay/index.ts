import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

    // 1. Get all living profiles that haven't logged in for >1 day
    const { data: staleProfiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, user_id, health, last_login_at, display_name, username, avatar_url, bio, fame, cash, age, experience, level, generation_number, is_active, died_at")
      .is("died_at", null)
      .eq("is_active", true)
      .lt("last_login_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (fetchError) {
      log("Error fetching stale profiles", fetchError);
      throw fetchError;
    }

    if (!staleProfiles || staleProfiles.length === 0) {
      log("No stale profiles found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log(`Found ${staleProfiles.length} stale profiles`);
    let processed = 0;
    let deaths = 0;

    for (const profile of staleProfiles) {
      const lastLogin = new Date(profile.last_login_at || Date.now());
      const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLogin < 1) continue;

      const healthDrain = daysSinceLogin * 5;
      const currentHealth = profile.health ?? 100;
      const newHealth = Math.max(0, currentHealth - healthDrain);

      log(`Profile ${profile.id}: ${daysSinceLogin} days offline, health ${currentHealth} → ${newHealth}`);

      // Check if character should die (health 0 AND 10+ days offline)
      if (newHealth <= 0 && daysSinceLogin >= 10) {
        log(`Character death: ${profile.display_name || profile.username}`, { profileId: profile.id });

        // Fetch skills snapshot
        const { data: skillData } = await supabase
          .from("skill_progress")
          .select("skill_slug, current_level")
          .eq("profile_id", profile.id);

        const finalSkills: Record<string, number> = {};
        if (skillData) {
          for (const s of skillData) {
            if (typeof s.current_level === "number") finalSkills[s.skill_slug] = s.current_level;
          }
        }

        // Fetch attributes snapshot
        const { data: attrData } = await supabase
          .from("player_attributes")
          .select("charisma, looks, mental_focus, musicality, physical_endurance, stage_presence, crowd_engagement, social_reach")
          .eq("profile_id", profile.id)
          .single();

        const finalAttributes: Record<string, number> = {};
        if (attrData) {
          for (const [k, v] of Object.entries(attrData)) {
            if (typeof v === "number") finalAttributes[k] = v;
          }
        }

        // Create Hall of Immortals entry
        await supabase.from("hall_of_immortals").insert({
          user_id: profile.user_id,
          profile_id: profile.id,
          character_name: profile.display_name || profile.username || "Unknown",
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          cause_of_death: "neglect",
          age_at_death: profile.age || 0,
          years_active: (profile.age || 16) - 16,
          total_fame: profile.fame || 0,
          total_cash_at_death: profile.cash || 0,
          final_skills: finalSkills,
          final_attributes: finalAttributes,
          generation_number: profile.generation_number || 1,
        });

        // Mark profile as dead
        await supabase
          .from("profiles")
          .update({
            health: 0,
            died_at: new Date().toISOString(),
            death_cause: "neglect",
            is_active: false,
          })
          .eq("id", profile.id);

        deaths++;
      } else {
        // Just drain health
        await supabase
          .from("profiles")
          .update({ health: newHealth })
          .eq("id", profile.id);
      }

      processed++;
    }

    log(`Completed. Processed: ${processed}, Deaths: ${deaths}`);
    return new Response(JSON.stringify({ processed, deaths }), {
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
