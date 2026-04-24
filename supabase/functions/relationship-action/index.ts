// Relationship Action — awards XP and skill XP for friend interactions,
// enforces per-pair daily caps, advances daily streak, returns reward summary.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ActionConfig {
  xp: number;
  skillXp: number;
  skillSlug?: string;
  dailyCap: number;
  category: string;
  label: string;
}

const ACTIONS: Record<string, ActionConfig> = {
  chat: { xp: 2, skillXp: 0, dailyCap: 5, category: "social", label: "Quick ping" },
  gift: { xp: 5, skillXp: 3, skillSlug: "charisma", dailyCap: 3, category: "social", label: "Gift" },
  hangout: { xp: 8, skillXp: 5, skillSlug: "charisma", dailyCap: 2, category: "social", label: "Hangout" },
  trade: { xp: 10, skillXp: 5, skillSlug: "business", dailyCap: 3, category: "social", label: "Trade" },
  jam: { xp: 15, skillXp: 10, skillSlug: "performance", dailyCap: 2, category: "performance", label: "Jam" },
  gig: { xp: 20, skillXp: 15, skillSlug: "performance", dailyCap: 1, category: "performance", label: "Gig collab" },
  songwriting: { xp: 20, skillXp: 15, skillSlug: "songwriting", dailyCap: 1, category: "songwriting", label: "Songwriting collab" },
  teach: { xp: 20, skillXp: 5, dailyCap: 4, category: "education", label: "Teach session (mentor)" },
  learn: { xp: 30, skillXp: 15, dailyCap: 4, category: "education", label: "Teach session (student)" },
};

const STREAK_BONUS = (day: number) => {
  if (day >= 14) return { xp: 100, skillXp: 50, label: "Day 14+ streak" };
  if (day >= 7) return { xp: 50, skillXp: 25, label: "Day 7 streak" };
  if (day >= 3) return { xp: 25, skillXp: 10, label: "Day 3 streak" };
  if (day >= 1) return { xp: 10, skillXp: 0, label: "Day 1 streak" };
  return { xp: 0, skillXp: 0, label: "" };
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function calculateRequiredXp(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level));
}

const MAX_SKILL_LEVEL = 20;

async function grantSkillXp(client: any, profileId: string, skillSlug: string, amount: number) {
  if (amount <= 0 || !skillSlug) return;
  const { data: skill } = await client
    .from("skill_progress")
    .select("current_xp, current_level, required_xp")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();

  const currentXp = skill?.current_xp ?? 0;
  let level = Math.min(skill?.current_level ?? 0, MAX_SKILL_LEVEL);
  let remaining = currentXp + amount;
  let required = skill?.required_xp ?? calculateRequiredXp(level);

  while (level < MAX_SKILL_LEVEL && remaining >= required) {
    remaining -= required;
    level += 1;
    required = calculateRequiredXp(level);
  }

  await client.from("skill_progress").upsert(
    {
      profile_id: profileId,
      skill_slug: skillSlug,
      current_xp: remaining,
      current_level: level,
      required_xp: calculateRequiredXp(level),
      last_practiced_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,skill_slug" },
  );
}

async function updateStreak(client: any, profileId: string): Promise<{ streak: number; bonusApplied: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await client
    .from("daily_social_streaks")
    .select("current_streak, last_interaction_date, total_days, longest_streak")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!existing) {
    await client.from("daily_social_streaks").insert({
      profile_id: profileId,
      current_streak: 1,
      last_interaction_date: today,
      total_days: 1,
      longest_streak: 1,
    });
    return { streak: 1, bonusApplied: true };
  }

  if (existing.last_interaction_date === today) {
    return { streak: existing.current_streak, bonusApplied: false };
  }

  const last = new Date(existing.last_interaction_date as string);
  const todayDate = new Date(today);
  const diffDays = Math.round((todayDate.getTime() - last.getTime()) / 86_400_000);
  const newStreak = diffDays === 1 ? existing.current_streak + 1 : 1;

  await client
    .from("daily_social_streaks")
    .update({
      current_streak: newStreak,
      last_interaction_date: today,
      total_days: existing.total_days + 1,
      longest_streak: Math.max(existing.longest_streak, newStreak),
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  return { streak: newStreak, bonusApplied: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, profile_id, other_profile_id, message, metadata } = body;

    if (!action || !profile_id || !other_profile_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = ACTIONS[action];
    if (!config) {
      return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify profile belongs to user
    const { data: profile } = await admin
      .from("profiles")
      .select("id, user_id")
      .eq("id", profile_id)
      .maybeSingle();
    if (!profile || profile.user_id !== user.id) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce daily cap (per pair, per action)
    const pk = pairKey(profile_id, other_profile_id);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { count: usedToday } = await admin
      .from("relationship_xp_log")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile_id)
      .eq("other_profile_id", other_profile_id)
      .eq("action_type", action)
      .gte("created_at", todayStart.toISOString());

    if ((usedToday ?? 0) >= config.dailyCap) {
      return new Response(JSON.stringify({
        success: false,
        error: `Daily limit reached for ${config.label} with this friend (${config.dailyCap}/day).`,
        cap_remaining: 0,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Award action XP via experience_ledger (matches progression edge function pattern)
    await admin.from("experience_ledger").insert({
      user_id: user.id,
      profile_id,
      activity_type: `relationship_${action}`,
      xp_amount: config.xp,
      metadata: {
        category: config.category,
        action_key: `relationship_${action}`,
        other_profile_id,
        pending_daily_process: true,
      },
    });

    // Grant skill XP instantly
    if (config.skillXp > 0 && config.skillSlug) {
      await grantSkillXp(admin, profile_id, config.skillSlug, config.skillXp);
    }

    // Log the relationship XP event
    await admin.from("relationship_xp_log").insert({
      profile_id,
      other_profile_id,
      pair_key: pk,
      action_type: action,
      xp_awarded: config.xp,
      skill_xp_awarded: config.skillXp,
      skill_slug: config.skillSlug ?? null,
    });

    // Mirror to activity_feed so existing affinity / timeline still works
    await admin.from("activity_feed").insert({
      user_id: user.id,
      activity_type: `relationship_${action}`,
      message: message ?? `${config.label} with friend`,
      metadata: {
        relationship_profile_id: other_profile_id,
        relationship_pair_key: pk,
        affinity_value: config.xp,
        ...(metadata ?? {}),
      },
    });

    // Streak update
    const { streak, bonusApplied } = await updateStreak(admin, profile_id);
    let streakReward = { xp: 0, skillXp: 0, label: "" };
    if (bonusApplied) {
      streakReward = STREAK_BONUS(streak);
      if (streakReward.xp > 0) {
        await admin.from("experience_ledger").insert({
          user_id: user.id,
          profile_id,
          activity_type: "social_streak_bonus",
          xp_amount: streakReward.xp,
          metadata: {
            category: "social",
            action_key: "social_streak_bonus",
            streak_day: streak,
            pending_daily_process: true,
          },
        });
      }
      if (streakReward.skillXp > 0) {
        await grantSkillXp(admin, profile_id, "charisma", streakReward.skillXp);
      }
    }

    // Lifetime XP + tier from helper
    const { data: tierData } = await admin.rpc("get_friendship_tier", {
      profile_a: profile_id,
      profile_b: other_profile_id,
    });
    const { data: lifetimeData } = await admin.rpc("get_friendship_lifetime_xp", {
      profile_a: profile_id,
      profile_b: other_profile_id,
    });

    return new Response(JSON.stringify({
      success: true,
      xp_awarded: config.xp,
      skill_xp_awarded: config.skillXp,
      skill_slug: config.skillSlug ?? null,
      cap_remaining: Math.max(0, config.dailyCap - (usedToday ?? 0) - 1),
      streak_days: streak,
      streak_bonus: bonusApplied && streakReward.xp > 0 ? streakReward : null,
      tier: tierData ?? "acquaintance",
      lifetime_xp: lifetimeData ?? 0,
      action_label: config.label,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("relationship-action error", err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
