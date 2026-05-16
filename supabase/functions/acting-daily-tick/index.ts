import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-shot daily tick for the acting career layer.
// Handles:
//  1. Film releases & weekly box office tracking (12 weeks)
//  2. Sequel offer rolls at week 6
//  3. Series episode airing
//  4. Season finale resolution -> renewal/cancellation
//  5. Renewal offer creation for cast
// Designed to be invoked by a daily cron job.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const today = new Date().toISOString().split("T")[0];
    const summary = {
      films_released: 0,
      film_weekly_rows: 0,
      sequels_offered: 0,
      episodes_aired: 0,
      seasons_resolved: 0,
      renewals_offered: 0,
    };

    // ---------- 1. Films: release any film whose premiere_date <= today ----------
    const { data: toRelease } = await admin.from("player_film_contracts").select("*")
      .lte("premiere_date", today).is("released_at", null)
      .in("status", ["accepted", "filming", "wrapped", "completed"]);
    for (const c of toRelease ?? []) {
      const fame = await getFame(admin, c.user_id);
      const roleMult = { cameo: 0.4, supporting: 0.8, lead: 1.4 }[c.role_type ?? "cameo"] ?? 0.6;
      const sequelBoost = c.is_sequel ? 1.3 : 1;
      // Opening weekend: $1M base × fame factor × role × random
      const base = 1_000_000 * 100; // cents
      const fameFactor = Math.min(8, 1 + fame / 25000);
      const opening = Math.round(base * fameFactor * roleMult * sequelBoost * (0.7 + Math.random() * 0.8));
      const critic = Math.max(30, Math.min(99, Math.round(50 + (Math.random() * 50) + (fame > 100000 ? 5 : 0))));
      const audience = Math.max(20, Math.min(99, Math.round(critic + (Math.random() * 20 - 10))));
      await admin.from("player_film_contracts").update({
        released_at: new Date().toISOString(),
        opening_weekend_cents: opening,
        critic_score: critic,
        audience_score: audience,
        status: "released",
      }).eq("id", c.id);
      summary.films_released++;
    }

    // ---------- 2. Films: weekly performance tracking for released films ----------
    const { data: released } = await admin.from("player_film_contracts").select("*")
      .not("released_at", "is", null).eq("status", "released");
    for (const c of released ?? []) {
      const releasedAt = new Date(c.released_at);
      const weeksSince = Math.floor((Date.now() - releasedAt.getTime()) / (7 * 86400_000));
      if (weeksSince < 1) continue;
      const currentWeek = Math.min(12, weeksSince);
      const { data: lastRow } = await admin.from("film_performance_weekly")
        .select("week_number, box_office_week_cents")
        .eq("contract_id", c.id).order("week_number", { ascending: false }).limit(1).maybeSingle();
      const fromWeek = (lastRow?.week_number ?? 0) + 1;
      if (fromWeek > currentWeek) continue;
      let prevBO = lastRow?.box_office_week_cents ?? Number(c.opening_weekend_cents ?? 0);
      let totalGross = Number(c.box_office_gross ?? 0);
      let totalStream = Number(c.streaming_views ?? 0);
      let totalMerchCents = Number(c.merch_revenue_cents ?? 0);
      for (let w = fromWeek; w <= currentWeek; w++) {
        const dropPct = 35 + Math.random() * 25; // 35-60% drop weekly
        const bo = Math.max(0, Math.round(prevBO * (1 - dropPct / 100)));
        const streams = Math.round(bo / 100 / 5); // streams scale loosely
        const merchUnits = Math.round(bo / 100 / 200);
        const merchRev = merchUnits * 3000; // $30 unit
        await admin.from("film_performance_weekly").insert({
          contract_id: c.id, week_number: w,
          box_office_week_cents: bo, streaming_views: streams,
          merch_units: merchUnits, merch_revenue_cents: merchRev,
          screens: Math.max(0, Math.round(3500 - w * 300)),
          drop_pct: Number(dropPct.toFixed(2)),
        });
        prevBO = bo;
        totalGross += bo;
        totalStream += streams;
        totalMerchCents += merchRev;
        summary.film_weekly_rows++;
      }
      await admin.from("player_film_contracts").update({
        box_office_gross: totalGross,
        streaming_views: totalStream,
        merch_revenue_cents: totalMerchCents,
        performance_calculated_at: new Date().toISOString(),
        status: currentWeek >= 12 ? "archived" : "released",
      }).eq("id", c.id);

      // ---------- 3. Sequel roll at week 6 ----------
      if (currentWeek >= 6 && !c.sequel_eligible) {
        const score = (Number(c.critic_score ?? 0) + Number(c.audience_score ?? 0)) / 2;
        const grossM = totalGross / 100 / 1_000_000;
        const sequelChance = Math.min(0.85, (score - 50) / 100 + grossM / 200);
        if (Math.random() < sequelChance) {
          // Spawn sequel offer (pay +60%)
          const newPay = Math.round(Number(c.total_pay_cents ?? 0) * 1.6);
          const future = new Date(); future.setDate(future.getDate() + 30);
          await admin.from("pr_media_offers").insert({
            user_id: c.user_id, media_type: "film",
            outlet_name: `${c.film_title ?? "Film"} 2`,
            role_type: c.role_type,
            base_pay_cents: newPay,
            compensation: Math.round(newPay / 100),
            fame_boost: 5000, fan_boost: 15000,
            proposed_date: future.toISOString().split("T")[0],
            status: "pending",
            parent_film_id: c.id,
          });
          await admin.from("player_film_contracts").update({ sequel_eligible: true }).eq("id", c.id);
          summary.sequels_offered++;
        } else {
          await admin.from("player_film_contracts").update({ sequel_eligible: true }).eq("id", c.id);
        }
      }
    }

    // ---------- 4. Series episodes: air any whose airdate <= today ----------
    const { data: eps } = await admin.from("series_episodes").select("*, series_seasons!inner(*)")
      .lte("airdate", today).eq("aired", false);
    for (const e of eps ?? []) {
      const season = e.series_seasons;
      // viewers: network reach baseline * hype * random
      const baseViewers = 500_000;
      const hype = 1 + ((season.episodes_aired ?? 0) > 0 ? (Number(season.avg_viewers ?? baseViewers) / baseViewers - 1) * 0.3 : 0);
      const live = Math.max(50_000, Math.round(baseViewers * hype * (0.6 + Math.random())));
      const seven = Math.round(live * (1.4 + Math.random() * 0.6));
      const buzz = Math.round(seven / 10000);
      await admin.from("series_episodes").update({
        aired: true, viewers_live: live, viewers_7day: seven, social_buzz: buzz,
      }).eq("id", e.id);
      const newAired = (season.episodes_aired ?? 0) + 1;
      const newTotal = Number(season.total_viewers ?? 0) + seven;
      const newAvg = Math.round(newTotal / newAired);
      await admin.from("series_seasons").update({
        episodes_aired: newAired, total_viewers: newTotal, avg_viewers: newAvg,
        status: newAired === 1 ? "airing" : season.status,
      }).eq("id", season.id);

      // Weekly perf row
      const week = newAired;
      const adRev = Math.round(seven * 5); // $0.05 cpm-ish in cents
      const merchRev = Math.round(seven * 2);
      await admin.from("series_performance_weekly").insert({
        season_id: season.id, week_number: week,
        viewers: seven, ad_revenue_cents: adRev,
        merch_revenue_cents: merchRev, streaming_views: Math.round(seven * 0.6),
      });
      summary.episodes_aired++;
    }

    // ---------- 5. Season finales: resolve renewal/cancellation ----------
    const { data: airing } = await admin.from("series_seasons").select("*")
      .eq("status", "airing").is("renewal_decision_at", null);
    for (const s of airing ?? []) {
      if ((s.episodes_aired ?? 0) < (s.episode_count ?? 10)) continue;
      // Resolve
      const critic = Math.max(40, Math.min(99, Math.round(55 + Math.random() * 35)));
      const audience = Math.max(30, Math.min(99, Math.round(critic + (Math.random() * 20 - 10))));
      const avgV = Number(s.avg_viewers ?? 0);
      const merchTotal = Math.round(avgV * (s.episode_count ?? 10) * 2);
      // Renewal: needs decent viewers OR critic score
      const renewScore = (avgV / 500_000) * 0.6 + (critic / 100) * 0.4;
      const renew = renewScore > 0.55;
      await admin.from("series_seasons").update({
        status: renew ? "wrapped" : "cancelled",
        critic_score: critic, audience_score: audience,
        total_merch_revenue_cents: merchTotal,
        renewal_decision: renew ? "renewed" : "cancelled",
        renewal_decision_at: new Date().toISOString(),
      }).eq("id", s.id);
      summary.seasons_resolved++;

      // Wrap player contracts
      const { data: contracts } = await admin.from("player_series_contracts")
        .select("*").eq("season_id", s.id).eq("status", "active");
      for (const pc of contracts ?? []) {
        await admin.from("player_series_contracts").update({
          status: "wrapped",
        }).eq("id", pc.id);

        if (renew) {
          // Pay rise scales with avg viewers vs 500k baseline
          const raise = Math.min(2.0, Math.max(1.05, avgV / 500_000));
          const newPay = Math.round(Number(pc.pay_per_episode_cents) * raise);
          await admin.from("series_renewal_offers").insert({
            user_id: pc.user_id,
            series_id: pc.series_id,
            prior_season_id: pc.season_id,
            new_season_number: (s.season_number ?? 1) + 1,
            offered_pay_per_episode_cents: newPay,
            episode_count: s.episode_count ?? 10,
            status: "pending",
          });
          summary.renewals_offered++;
        }
      }

      if (renew) {
        await admin.from("scripted_series").update({
          current_season: (s.season_number ?? 1) + 1,
        }).eq("id", s.series_id);
      } else {
        await admin.from("scripted_series").update({
          is_open_for_casting: false,
        }).eq("id", s.series_id);
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[acting-daily-tick]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getFame(admin: any, userId: string): Promise<number> {
  const { data } = await admin.from("profiles").select("fame")
    .eq("user_id", userId).eq("is_active", true).is("died_at", null).maybeSingle();
  return Number(data?.fame ?? 0);
}
