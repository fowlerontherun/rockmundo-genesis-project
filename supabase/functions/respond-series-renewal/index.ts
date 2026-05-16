import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Respond to a series renewal offer.
// Body: { renewalId: string, action: 'accept' | 'reject' | 'counter', counterCents?: number }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ur } = await userClient.auth.getUser();
    const user = ur.user; if (!user) throw new Error("Not authenticated");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { renewalId, action, counterCents } = await req.json();
    if (!renewalId) throw new Error("renewalId required");

    const { data: r } = await admin.from("series_renewal_offers")
      .select("*").eq("id", renewalId).maybeSingle();
    if (!r) throw new Error("Renewal not found");
    if (r.user_id !== user.id) throw new Error("Not yours");
    if (r.status !== "pending") throw new Error(`Already ${r.status}`);

    if (action === "reject") {
      await admin.from("series_renewal_offers").update({
        status: "rejected", responded_at: new Date().toISOString(),
      }).eq("id", renewalId);
      return ok({ result: "rejected" });
    }

    // Determine accepted pay
    let acceptedPay = Number(r.offered_pay_per_episode_cents);
    if (action === "counter") {
      const counter = Math.round(counterCents ?? 0);
      if (counter <= 0) throw new Error("counterCents required");
      const ratio = counter / acceptedPay;
      // 80% chance accept if <=1.1x, drops to 0 at 1.6x
      const prob = ratio <= 1 ? 1 : Math.max(0, 1 - (ratio - 1) / 0.6);
      if (Math.random() > prob) {
        // Studio walks; offer stays at original but counted as rejected
        await admin.from("series_renewal_offers").update({
          status: "rejected", responded_at: new Date().toISOString(),
        }).eq("id", renewalId);
        return ok({ result: "studio_walked", prob });
      }
      acceptedPay = counter;
    }

    // Create new player_series_contract for new season
    // First, find/create the new season row
    let { data: newSeason } = await admin.from("series_seasons")
      .select("*").eq("series_id", r.series_id).eq("season_number", r.new_season_number).maybeSingle();
    if (!newSeason) {
      const filmingStart = new Date(); filmingStart.setDate(filmingStart.getDate() + 14);
      const filmingEnd = new Date(filmingStart); filmingEnd.setDate(filmingEnd.getDate() + 60);
      const premiere = new Date(filmingEnd); premiere.setDate(premiere.getDate() + 90);
      const finale = new Date(premiere); finale.setDate(finale.getDate() + (r.episode_count - 1) * 7);
      const { data: created, error } = await admin.from("series_seasons").insert({
        series_id: r.series_id,
        season_number: r.new_season_number,
        status: "announced",
        episode_count: r.episode_count,
        filming_start: filmingStart.toISOString().split("T")[0],
        filming_end: filmingEnd.toISOString().split("T")[0],
        premiere_date: premiere.toISOString().split("T")[0],
        finale_date: finale.toISOString().split("T")[0],
      }).select().single();
      if (error) throw error;
      newSeason = created;

      // Pre-generate episodes
      for (let i = 1; i <= r.episode_count; i++) {
        const ad = new Date(premiere); ad.setDate(ad.getDate() + (i - 1) * 7);
        await admin.from("series_episodes").insert({
          season_id: newSeason.id, episode_number: i,
          title: `S${r.new_season_number} E${i}`,
          airdate: ad.toISOString().split("T")[0], aired: false,
        });
      }
    }

    await admin.from("player_series_contracts").insert({
      user_id: user.id,
      series_id: r.series_id,
      season_id: newSeason.id,
      role_name: "Returning Role",
      role_type: "supporting",
      pay_per_episode_cents: acceptedPay,
      episode_count: r.episode_count,
      total_pay_cents: acceptedPay * r.episode_count,
      status: "active",
    });

    await admin.from("series_renewal_offers").update({
      status: "accepted", responded_at: new Date().toISOString(),
      offered_pay_per_episode_cents: acceptedPay,
    }).eq("id", renewalId);

    return ok({ result: "accepted", final_cents: acceptedPay, season_id: newSeason.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[respond-series-renewal]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(p: unknown) {
  return new Response(JSON.stringify(p), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
