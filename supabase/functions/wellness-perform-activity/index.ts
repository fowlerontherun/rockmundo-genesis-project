import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { profile_id, catalog_slug } = body ?? {};
    if (!profile_id || !catalog_slug) return json({ error: "profile_id and catalog_slug required" }, 400);

    // Verify ownership
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, user_id, health, energy, mood, stress, cash, fame")
      .eq("id", profile_id)
      .single();
    if (profErr || !profile) return json({ error: "profile not found" }, 404);
    if (profile.user_id !== user.id) return json({ error: "forbidden" }, 403);

    // Fetch catalog entry
    const { data: entry } = await supabase
      .from("wellness_activity_catalog")
      .select("*")
      .eq("slug", catalog_slug)
      .eq("is_active", true)
      .single();
    if (!entry) return json({ error: "activity not found" }, 404);

    if ((profile.fame ?? 0) < entry.unlock_min_fame) {
      return json({ error: `Locked until fame ${entry.unlock_min_fame}` }, 403);
    }

    // Cooldown check
    const { data: last } = await supabase
      .from("wellness_activity_log")
      .select("cooldown_until")
      .eq("profile_id", profile_id)
      .eq("catalog_slug", catalog_slug)
      .order("performed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.cooldown_until && new Date(last.cooldown_until) > new Date()) {
      return json({ error: "On cooldown", cooldown_until: last.cooldown_until }, 429);
    }

    // Daily caps
    const since = new Date(); since.setHours(since.getHours() - 24);
    const { count: dayCount } = await supabase
      .from("wellness_activity_log")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profile_id)
      .gte("performed_at", since.toISOString());
    if ((dayCount ?? 0) >= 3) return json({ error: "Daily wellness action cap reached (3/day)" }, 429);

    if (entry.category === "indulgence") {
      const { count: indCount } = await supabase
        .from("wellness_activity_log")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile_id)
        .eq("category", "indulgence")
        .gte("performed_at", since.toISOString());
      if ((indCount ?? 0) >= 1) return json({ error: "Only 1 indulgence per day" }, 429);
    }

    // Stamina check
    if ((profile.energy ?? 0) < entry.stamina_cost) {
      return json({ error: `Not enough energy (need ${entry.stamina_cost}, have ${profile.energy})` }, 400);
    }
    // Cash check
    if (entry.cost_cents > 0 && (profile.cash ?? 0) * 100 < entry.cost_cents) {
      return json({ error: "Not enough cash" }, 400);
    }

    // Gate check
    const activityType = `wellness_${entry.category}`;
    const { data: gate } = await supabase.rpc("evaluate_wellness_gate", { _profile_id: profile_id, _activity_type: activityType });
    const gateRow = Array.isArray(gate) ? gate[0] : gate;
    if (gateRow && gateRow.allowed === false) {
      return json({ error: gateRow.reason, suggestion_slug: gateRow.suggestion_slug }, 423);
    }

    // Apply stat effects
    const eff = entry.stat_effects ?? {};
    const newHealth = clamp((profile.health ?? 100) + (eff.health ?? 0));
    const newEnergy = clamp((profile.energy ?? 100) + (eff.energy ?? 0) - entry.stamina_cost);
    const newMood = clamp((profile.mood ?? 70) + (eff.mood ?? 0));
    const newStress = clamp((profile.stress ?? 30) + (eff.stress ?? 0));
    const cashDelta = Math.floor(entry.cost_cents / 100);

    await supabase
      .from("profiles")
      .update({
        health: newHealth,
        energy: newEnergy,
        mood: newMood,
        stress: newStress,
        cash: (profile.cash ?? 0) - cashDelta,
        last_health_update: new Date().toISOString(),
      })
      .eq("id", profile_id);

    // Log
    const cooldownUntil = new Date(Date.now() + entry.cooldown_hours * 3600_000).toISOString();
    await supabase.from("wellness_activity_log").insert({
      user_id: user.id,
      profile_id,
      catalog_id: entry.id,
      catalog_slug: entry.slug,
      category: entry.category,
      cooldown_until: cooldownUntil,
      stat_delta: { health: eff.health ?? 0, energy: (eff.energy ?? 0) - entry.stamina_cost, mood: eff.mood ?? 0, stress: eff.stress ?? 0 },
      cost_cents: entry.cost_cents,
    });

    // Treat ailment
    if (entry.treats_ailment_slug) {
      await supabase
        .from("player_ailments")
        .update({ resolved_at: new Date().toISOString() })
        .eq("profile_id", profile_id)
        .eq("slug", entry.treats_ailment_slug)
        .is("resolved_at", null);
    }

    // Roll ailments (indulgence)
    const rolled: string[] = [];
    const risk = entry.ailment_risk ?? {};
    for (const [slug, p] of Object.entries(risk as Record<string, number>)) {
      if (Math.random() < p) {
        const ailment = AILMENT_TEMPLATES[slug];
        if (!ailment) continue;
        await supabase.from("player_ailments").insert({
          user_id: user.id, profile_id,
          slug, name: ailment.name, severity: ailment.severity,
          treatment_required_slug: ailment.treatment, blocks_activity_types: ailment.blocks,
          stat_penalty: ailment.penalty, description: ailment.description,
          source: entry.slug,
        });
        rolled.push(ailment.name);
      }
    }

    // Long activities create a schedule block
    if (entry.duration_minutes >= 60) {
      const end = new Date(Date.now() + entry.duration_minutes * 60_000).toISOString();
      await supabase.from("player_scheduled_activities").insert({
        user_id: user.id, profile_id,
        activity_type: `wellness_${entry.category}`,
        scheduled_start: new Date().toISOString(),
        scheduled_end: end,
        duration_minutes: entry.duration_minutes,
        status: "in_progress",
        title: entry.name,
        description: entry.description,
        metadata: { wellness_catalog_slug: entry.slug },
      });
    }

    return json({
      ok: true,
      cooldown_until: cooldownUntil,
      new_stats: { health: newHealth, energy: newEnergy, mood: newMood, stress: newStress },
      ailments_contracted: rolled,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const AILMENT_TEMPLATES: Record<string, { name: string; severity: number; treatment: string; blocks: string[]; penalty: Record<string, number>; description: string }> = {
  vocal_strain: { name: "Vocal Strain", severity: 2, treatment: "vocal_coach_checkup", blocks: ["gig","tour","recording","performance"], penalty: { performance: -25 }, description: "Your voice is shot. Sing and you''ll make it worse." },
  sore_throat: { name: "Sore Throat", severity: 1, treatment: "doctor_visit", blocks: ["gig","performance"], penalty: { performance: -10 }, description: "Scratchy throat." },
  flu: { name: "Flu", severity: 2, treatment: "doctor_visit", blocks: ["gig","tour","recording","work","wellness_fitness","performance"], penalty: { performance: -30 }, description: "Bedridden." },
  sprained_wrist: { name: "Sprained Wrist", severity: 2, treatment: "physio", blocks: ["gig","recording","wellness_fitness","jam"], penalty: { performance: -20 }, description: "Hard to play." },
  insomnia: { name: "Insomnia", severity: 1, treatment: "therapy_session", blocks: [], penalty: { energy_regen: -50 }, description: "Energy regen halved." },
  burnout: { name: "Burnout", severity: 3, treatment: "mental_clinic", blocks: ["gig","tour","recording","jam","work","wellness_fitness","wellness_indulgence","performance"], penalty: { performance: -40 }, description: "Completely fried." },
  panic_attack: { name: "Panic Episode", severity: 2, treatment: "therapy_session", blocks: ["gig","performance"], penalty: { performance: -25 }, description: "Anxious on stage." },
  food_poisoning: { name: "Food Poisoning", severity: 2, treatment: "doctor_visit", blocks: ["gig","tour","wellness_fitness","work","performance"], penalty: { performance: -20 }, description: "Don''t stray from the bathroom." },
  hangover: { name: "Hangover", severity: 1, treatment: "sleep_in", blocks: ["wellness_fitness","work"], penalty: { performance: -15 }, description: "Pounding headache." },
  back_pain: { name: "Back Pain", severity: 1, treatment: "physio", blocks: ["wellness_fitness"], penalty: { performance: -10 }, description: "Lower back is locked up." },
  depression_spell: { name: "Depressive Spell", severity: 2, treatment: "therapy_session", blocks: ["wellness_fitness","wellness_indulgence","gig","performance"], penalty: { performance: -25 }, description: "Can''t shake the gloom." },
  withdrawal: { name: "Withdrawal", severity: 3, treatment: "rehab_intake", blocks: ["gig","tour","recording","jam","work","performance"], penalty: { performance: -35 }, description: "Body is fighting addiction." },
};
