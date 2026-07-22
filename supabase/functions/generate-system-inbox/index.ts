import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MILESTONES = [1000, 10000, 100000, 1000000];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { welcome: 0, lowCash: 0, milestones: 0, weekly: 0, dailySummary: 0, profiles: 0, snapshots: 0 };
  const now = new Date();
  const isMonday = now.getUTCDay() === 1;
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const last24hISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // Only iterate profiles touched in the last 14 days (active or not – multiple chars per user supported)
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, username, cash, fame, fans, created_at")
      .gte("updated_at", fourteenDaysAgo);

    stats.profiles = profiles?.length ?? 0;

    for (const p of profiles ?? []) {
      const baseMeta = { profile_id: p.id };

      // Welcome message removed — it was re-appearing daily and duplicates the onboarding flow.


      // ===== 2. LOW CASH (per profile, 14-day dedup, only if this profile is poor) =====
      const cashDollars = (p.cash ?? 0) / 100;
      if (cashDollars > 0 && cashDollars < 1000) {
        const { data: recentLowCash } = await supabase
          .from("player_inbox")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("category", "financial")
          .contains("metadata", { kind: "low_cash", profile_id: p.id })
          .gte("created_at", fourteenDaysAgo)
          .limit(1)
          .maybeSingle();

        if (!recentLowCash) {
          await supabase.from("player_inbox").insert({
            user_id: p.user_id,
            category: "financial",
            priority: "high",
            title: `Low cash warning${p.username ? ` — ${p.username}` : ""}`,
            message: `${p.username || "This character"}'s balance is $${cashDollars.toFixed(0)}. Consider booking a gig, picking up a shift, or selling merch.`,
            metadata: { ...baseMeta, kind: "low_cash", balance: cashDollars },
            is_read: false,
            is_archived: false,
          });
          stats.lowCash++;
        }
      }

      // ===== 3. SALES MILESTONES — released titles owned by this profile =====
      const { data: rels } = await supabase
        .from("releases")
        .select("id, title, total_units_sold, profile_id")
        .eq("user_id", p.user_id)
        .eq("release_status", "released");

      for (const r of rels ?? []) {
        // Only attribute if release belongs to this profile (or unscoped legacy rows)
        if ((r as any).profile_id && (r as any).profile_id !== p.id) continue;
        const units = r.total_units_sold ?? 0;
        for (const m of MILESTONES) {
          if (units >= m) {
            const { data: existing } = await supabase
              .from("player_inbox")
              .select("id")
              .eq("user_id", p.user_id)
              .eq("related_entity_type", "release")
              .eq("related_entity_id", r.id)
              .contains("metadata", { kind: "sales_milestone", milestone: m })
              .limit(1)
              .maybeSingle();
            if (!existing) {
              await supabase.from("player_inbox").insert({
                user_id: p.user_id,
                category: "financial",
                priority: "normal",
                title: `${m.toLocaleString()} units sold!`,
                message: `"${r.title}" just crossed ${m.toLocaleString()} units sold. Congratulations!`,
                metadata: { ...baseMeta, kind: "sales_milestone", milestone: m, units },
                related_entity_type: "release",
                related_entity_id: r.id,
                is_read: false,
                is_archived: false,
              });
              stats.milestones++;
            }
          }
        }
      }

      // ===== 4. DAILY SUMMARY (once per profile per day) =====
      const { data: existingSummary } = await supabase
        .from("player_inbox")
        .select("id")
        .eq("user_id", p.user_id)
        .eq("category", "system")
        .contains("metadata", { kind: "daily_summary", profile_id: p.id, date: todayStr })
        .limit(1)
        .maybeSingle();

      if (!existingSummary) {
        // Yesterday's snapshot for deltas
        const { data: prevSnap } = await supabase
          .from("profile_daily_snapshots")
          .select("fame, fans, cash")
          .eq("profile_id", p.id)
          .lt("snapshot_date", todayStr)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        const fameNow = p.fame ?? 0;
        const fansNow = p.fans ?? 0;
        const cashNow = p.cash ?? 0;
        const fameDelta = prevSnap ? fameNow - (prevSnap.fame ?? 0) : 0;
        const fansDelta = prevSnap ? fansNow - (prevSnap.fans ?? 0) : 0;
        const cashDelta = prevSnap ? cashNow - (prevSnap.cash ?? 0) : 0;

        // XP grants in last 24h
        const { data: xpRows } = await supabase
          .from("profile_daily_xp_grants")
          .select("xp_amount, attribute_points_amount, source")
          .eq("profile_id", p.id)
          .gte("grant_date", yesterdayStr);
        const xpGained = (xpRows ?? []).reduce((s, r: any) => s + (r.xp_amount ?? 0), 0);
        const apGained = (xpRows ?? []).reduce((s, r: any) => s + (r.attribute_points_amount ?? 0), 0);

        // Gigs the profile played in last 24h via band membership
        const { data: memberships } = await supabase
          .from("band_members")
          .select("band_id")
          .eq("profile_id", p.id);
        const bandIds = (memberships ?? []).map((m: any) => m.band_id).filter(Boolean);
        let gigsPlayed = 0;
        let bestGrade: string | null = null;
        let gigFame = 0, gigFans = 0;
        if (bandIds.length) {
          const { data: outcomes } = await supabase
            .from("gig_outcomes")
            .select("performance_grade, fame_gained, casual_fans_gained, dedicated_fans_gained, superfans_gained, completed_at, venue_name")
            .in("band_id", bandIds)
            .gte("completed_at", last24hISO);
          gigsPlayed = outcomes?.length ?? 0;
          const order = ["F", "D", "C", "B", "A", "S"];
          for (const o of outcomes ?? []) {
            gigFame += o.fame_gained ?? 0;
            gigFans += (o.casual_fans_gained ?? 0) + (o.dedicated_fans_gained ?? 0) + (o.superfans_gained ?? 0);
            if (o.performance_grade && (!bestGrade || order.indexOf(o.performance_grade) > order.indexOf(bestGrade))) {
              bestGrade = o.performance_grade;
            }
          }
        }

        // Only post a summary if something actually happened
        const somethingHappened = xpGained > 0 || apGained > 0 || gigsPlayed > 0 || fameDelta !== 0 || fansDelta !== 0;
        if (somethingHappened) {
          const parts: string[] = [];
          if (gigsPlayed > 0) parts.push(`🎤 ${gigsPlayed} gig${gigsPlayed > 1 ? "s" : ""} played${bestGrade ? ` (best: ${bestGrade})` : ""}`);
          if (fameDelta !== 0) parts.push(`⭐ Fame ${fameDelta > 0 ? "+" : ""}${fameDelta.toLocaleString()} (now ${fameNow.toLocaleString()})`);
          if (fansDelta !== 0) parts.push(`👥 Fans ${fansDelta > 0 ? "+" : ""}${fansDelta.toLocaleString()} (now ${fansNow.toLocaleString()})`);
          if (xpGained > 0) parts.push(`📚 ${xpGained.toLocaleString()} XP earned`);
          if (apGained > 0) parts.push(`🎯 ${apGained} attribute point${apGained > 1 ? "s" : ""}`);
          if (cashDelta !== 0) parts.push(`💵 Cash ${cashDelta > 0 ? "+" : ""}$${(cashDelta / 100).toFixed(0)}`);

          await supabase.from("player_inbox").insert({
            user_id: p.user_id,
            category: "system",
            priority: "low",
            title: `Daily summary${p.username ? ` — ${p.username}` : ""}`,
            message: parts.join("  •  ") || "Quiet day. Nothing major to report.",
            metadata: {
              ...baseMeta,
              kind: "daily_summary",
              date: todayStr,
              gigs_played: gigsPlayed,
              best_grade: bestGrade,
              fame_delta: fameDelta,
              fans_delta: fansDelta,
              xp_gained: xpGained,
              ap_gained: apGained,
              cash_delta: cashDelta,
              gig_fame: gigFame,
              gig_fans: gigFans,
            },
            is_read: false,
            is_archived: false,
          });
          stats.dailySummary++;
        }

        // Always upsert today's snapshot so tomorrow has a baseline
        await supabase.from("profile_daily_snapshots").upsert(
          { profile_id: p.id, snapshot_date: todayStr, fame: fameNow, fans: fansNow, cash: cashNow },
          { onConflict: "profile_id,snapshot_date" }
        );
        stats.snapshots++;
      }

      // ===== 5. WEEKLY RECAP — Mondays only, dedup per profile per ISO week =====
      if (isMonday) {
        const weekKey = `${now.getUTCFullYear()}-W${Math.ceil((now.getUTCDate() + 6 - now.getUTCDay()) / 7)}`;
        const { data: existingWeek } = await supabase
          .from("player_inbox")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("category", "system")
          .contains("metadata", { kind: "weekly_recap", week: weekKey, profile_id: p.id })
          .limit(1)
          .maybeSingle();

        if (!existingWeek) {
          await supabase.from("player_inbox").insert({
            user_id: p.user_id,
            category: "system",
            priority: "low",
            title: `Your week in review${p.username ? ` — ${p.username}` : ""}`,
            message: `Here's a quick recap of your past week. Check Finances and Releases tabs for details.`,
            metadata: { ...baseMeta, kind: "weekly_recap", week: weekKey },
            is_read: false,
            is_archived: false,
          });
          stats.weekly++;
        }
      }
    }

    console.log("[generate-system-inbox]", stats);
    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-system-inbox] error", e);
    return new Response(JSON.stringify({ success: false, error: String(e), stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
