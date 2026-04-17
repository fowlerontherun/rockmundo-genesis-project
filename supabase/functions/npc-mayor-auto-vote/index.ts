// NPC Mayor Auto-Vote
// ---------------------------------------------------------------------------
// Picks every open parliament motion whose voting_closes_at is within the next
// 6 hours and casts deterministic votes for any sitting "NPC" mayor that has
// not yet voted. An NPC mayor is one whose `profile_id` does NOT have a row
// in `profiles` (i.e. unmanaged seat) — these auto-votes ensure quorum is
// reachable even when most cities have no human mayor.
//
// Voting heuristic: motion_type drives a base "yes" probability, biased by
// city size (larger cities lean yes on infrastructure, smaller lean yes on
// pay). Final vote is yes / no / abstain. Tally counters on the motion are
// updated atomically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Vote = "yes" | "no" | "abstain";

function decideVote(motionType: string, cityPop: number, seed: string): Vote {
  // Cheap deterministic PRNG seeded by motion+mayor IDs
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = ((h >>> 0) % 1000) / 1000; // 0..1

  let yesP = 0.55;
  if (motionType === "mayor_pay") yesP = cityPop < 500_000 ? 0.7 : 0.45;
  else if (motionType === "infrastructure") yesP = cityPop > 1_000_000 ? 0.75 : 0.5;
  else if (motionType === "tax") yesP = 0.4;
  else if (motionType === "policy") yesP = 0.55;

  if (r < yesP * 0.85) return "yes";
  if (r < yesP * 0.85 + 0.1) return "abstain";
  return "no";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const horizon = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: motions, error: mErr } = await supabase
      .from("world_parliament_motions")
      .select("id, motion_type, voting_closes_at, yes_votes, no_votes, abstain_votes")
      .eq("status", "open")
      .lte("voting_closes_at", horizon)
      .gt("voting_closes_at", nowIso)
      .limit(50);
    if (mErr) throw mErr;

    const { data: mayors, error: maErr } = await supabase
      .from("city_mayors")
      .select("id, profile_id, city_id")
      .eq("is_current", true)
      .limit(500);
    if (maErr) throw maErr;

    if (!motions?.length || !mayors?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify managed (human) profile IDs
    const profileIds = [...new Set(mayors.map((m) => m.profile_id).filter(Boolean))];
    const { data: humanProfiles } = await supabase
      .from("profiles")
      .select("id")
      .in("id", profileIds);
    const humanSet = new Set((humanProfiles ?? []).map((p: { id: string }) => p.id));
    const npcMayors = mayors.filter((m) => !humanSet.has(m.profile_id));

    // Pull city populations once
    const cityIds = [...new Set(npcMayors.map((m) => m.city_id))];
    const { data: cities } = await supabase
      .from("cities")
      .select("id, population")
      .in("id", cityIds);
    const popMap = new Map(
      (cities ?? []).map((c: { id: string; population: number | null }) => [c.id, c.population ?? 250_000]),
    );

    let totalCast = 0;

    for (const motion of motions) {
      // Pull existing votes for this motion to skip already-voted mayors
      const { data: existing } = await supabase
        .from("world_parliament_votes")
        .select("mayor_id")
        .eq("motion_id", motion.id);
      const voted = new Set((existing ?? []).map((v: { mayor_id: string }) => v.mayor_id));

      let yesD = 0, noD = 0, abstainD = 0;
      const inserts: Array<Record<string, unknown>> = [];

      for (const mayor of npcMayors) {
        if (voted.has(mayor.id)) continue;
        const pop = Number(popMap.get(mayor.city_id) ?? 250_000);
        const vote = decideVote(motion.motion_type, pop, motion.id + mayor.id);
        inserts.push({
          motion_id: motion.id,
          mayor_id: mayor.id,
          voter_profile_id: mayor.profile_id,
          vote,
          voted_at: nowIso,
        });
        if (vote === "yes") yesD++;
        else if (vote === "no") noD++;
        else abstainD++;
      }

      if (inserts.length) {
        const { error: insErr } = await supabase
          .from("world_parliament_votes")
          .insert(inserts);
        if (insErr) {
          console.error("vote insert error", motion.id, insErr.message);
          continue;
        }
        await supabase
          .from("world_parliament_motions")
          .update({
            yes_votes: (motion.yes_votes ?? 0) + yesD,
            no_votes: (motion.no_votes ?? 0) + noD,
            abstain_votes: (motion.abstain_votes ?? 0) + abstainD,
          })
          .eq("id", motion.id);
        totalCast += inserts.length;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, motions: motions.length, votes_cast: totalCast }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
