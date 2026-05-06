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

  const stats = { welcome: 0, lowCash: 0, milestones: 0, weekly: 0, profiles: 0 };
  const isMonday = new Date().getUTCDay() === 1;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, user_id, username, cash, created_at")
      .gte("updated_at", thirtyDaysAgo);

    stats.profiles = profiles?.length ?? 0;

    for (const p of profiles ?? []) {
      // 1. WELCOME (once per user_id)
      const { data: existingWelcome } = await supabase
        .from("player_inbox")
        .select("id")
        .eq("user_id", p.user_id)
        .eq("category", "system")
        .contains("metadata", { kind: "welcome" })
        .limit(1)
        .maybeSingle();

      if (!existingWelcome) {
        await supabase.from("player_inbox").insert({
          user_id: p.user_id,
          category: "system",
          priority: "normal",
          title: "Welcome to Rockmundo",
          message: `Hey ${p.username || "there"} — your inbox is where you'll see gig results, label offers, random events, sales milestones, and weekly recaps. Check back often!`,
          metadata: { kind: "welcome" },
          is_read: false,
          is_archived: false,
        });
        stats.welcome++;
      }

      // 2. LOW CASH (once per 7 days)
      const cashDollars = (p.cash ?? 0) / 100;
      if (cashDollars > 0 && cashDollars < 1000) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentLowCash } = await supabase
          .from("player_inbox")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("category", "financial")
          .contains("metadata", { kind: "low_cash" })
          .gte("created_at", sevenDaysAgo)
          .limit(1)
          .maybeSingle();

        if (!recentLowCash) {
          await supabase.from("player_inbox").insert({
            user_id: p.user_id,
            category: "financial",
            priority: "high",
            title: "Low cash warning",
            message: `Your balance is $${cashDollars.toFixed(0)}. Consider booking a gig, picking up a shift, or selling merch.`,
            metadata: { kind: "low_cash", balance: cashDollars },
            is_read: false,
            is_archived: false,
          });
          stats.lowCash++;
        }
      }

      // 3. SALES MILESTONES — released titles
      const { data: rels } = await supabase
        .from("releases")
        .select("id, title, total_units_sold")
        .eq("user_id", p.user_id)
        .eq("release_status", "released");

      for (const r of rels ?? []) {
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
                metadata: { kind: "sales_milestone", milestone: m, units },
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

      // 4. WEEKLY RECAP — Mondays only, dedupe by ISO week
      if (isMonday) {
        const now = new Date();
        const weekKey = `${now.getUTCFullYear()}-W${Math.ceil((now.getUTCDate() + 6 - now.getUTCDay()) / 7)}`;
        const { data: existingWeek } = await supabase
          .from("player_inbox")
          .select("id")
          .eq("user_id", p.user_id)
          .eq("category", "system")
          .contains("metadata", { kind: "weekly_recap", week: weekKey })
          .limit(1)
          .maybeSingle();

        if (!existingWeek) {
          await supabase.from("player_inbox").insert({
            user_id: p.user_id,
            category: "system",
            priority: "low",
            title: "Your week in review",
            message: `Here's a quick recap of your past week. Check Finances and Releases tabs for details.`,
            metadata: { kind: "weekly_recap", week: weekKey },
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
