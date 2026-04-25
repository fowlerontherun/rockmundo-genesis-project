// Co-op Quest — generate a daily/weekly quest for a friend pair, claim rewards.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QuestTemplate {
  key: string;
  title: string;
  description: string;
  action_type: string;
  target_count: number;
  reward_xp: number;
  reward_skill_xp: number;
  reward_skill_slug?: string;
  cadence: "daily" | "weekly";
}

const DAILY_TEMPLATES: QuestTemplate[] = [
  { key: "daily_chat",  title: "Stay in touch",   description: "Send 2 quick pings each.",    action_type: "chat",    target_count: 2, reward_xp: 25, reward_skill_xp: 5,  reward_skill_slug: "charisma",    cadence: "daily" },
  { key: "daily_jam",   title: "Daily jam",       description: "Run 1 jam session each.",     action_type: "jam",     target_count: 1, reward_xp: 40, reward_skill_xp: 15, reward_skill_slug: "performance", cadence: "daily" },
  { key: "daily_gift",  title: "Generous duo",    description: "Each send 1 gift today.",     action_type: "gift",    target_count: 1, reward_xp: 30, reward_skill_xp: 10, reward_skill_slug: "charisma",    cadence: "daily" },
  { key: "daily_trade", title: "Trading partners",description: "Each complete 1 trade.",      action_type: "trade",   target_count: 1, reward_xp: 35, reward_skill_xp: 10, reward_skill_slug: "business",    cadence: "daily" },
];

const WEEKLY_TEMPLATES: QuestTemplate[] = [
  { key: "weekly_collab",  title: "Collab streak",     description: "Co-write 2 songs together this week.", action_type: "songwriting", target_count: 2, reward_xp: 150, reward_skill_xp: 60, reward_skill_slug: "songwriting", cadence: "weekly" },
  { key: "weekly_gigs",    title: "Tour buddies",      description: "Play 2 gig collabs together.",         action_type: "gig",         target_count: 2, reward_xp: 200, reward_skill_xp: 75, reward_skill_slug: "performance", cadence: "weekly" },
  { key: "weekly_hangout", title: "Best of friends",   description: "Plan 5 hangouts each this week.",      action_type: "hangout",     target_count: 5, reward_xp: 120, reward_skill_xp: 40, reward_skill_slug: "charisma",    cadence: "weekly" },
];

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function endOfDay(): Date {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function endOfWeek(): Date {
  const d = new Date();
  const day = d.getUTCDay(); // 0..6 (Sun..Sat)
  const daysUntilSunday = (7 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function grantSkillXp(client: any, profileId: string, skillSlug: string, amount: number) {
  if (amount <= 0 || !skillSlug) return;
  const { data: skill } = await client
    .from("skill_progress")
    .select("current_xp, current_level, required_xp")
    .eq("profile_id", profileId)
    .eq("skill_slug", skillSlug)
    .maybeSingle();
  const calcReq = (lvl: number) => Math.floor(100 * Math.pow(1.5, lvl));
  const currentXp = skill?.current_xp ?? 0;
  let level = Math.min(skill?.current_level ?? 0, 20);
  let remaining = currentXp + amount;
  let required = skill?.required_xp ?? calcReq(level);
  while (level < 20 && remaining >= required) {
    remaining -= required;
    level += 1;
    required = calcReq(level);
  }
  await client.from("skill_progress").upsert(
    {
      profile_id: profileId,
      skill_slug: skillSlug,
      current_xp: remaining,
      current_level: level,
      required_xp: calcReq(level),
      last_practiced_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,skill_slug" },
  );
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
    const { op, profile_id, other_profile_id, cadence, quest_id } = body;

    if (!op || !profile_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing op or profile_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller owns profile
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

    if (op === "create") {
      if (!other_profile_id || !cadence) {
        return new Response(JSON.stringify({ success: false, error: "Missing other_profile_id or cadence" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pk = pairKey(profile_id, other_profile_id);
      const expires_at = cadence === "weekly" ? endOfWeek().toISOString() : endOfDay().toISOString();

      // Check existing active quest of same cadence for this pair
      const { data: existing } = await admin
        .from("coop_quests")
        .select("id")
        .eq("pair_key", pk)
        .eq("cadence", cadence)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: `An active ${cadence} quest already exists for this pair.`,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tpl = pick(cadence === "weekly" ? WEEKLY_TEMPLATES : DAILY_TEMPLATES);
      const { data: created, error: insErr } = await admin
        .from("coop_quests")
        .insert({
          profile_a_id: profile_id,
          profile_b_id: other_profile_id,
          pair_key: pk,
          quest_key: tpl.key,
          title: tpl.title,
          description: tpl.description,
          action_type: tpl.action_type,
          target_count: tpl.target_count,
          reward_xp: tpl.reward_xp,
          reward_skill_xp: tpl.reward_skill_xp,
          reward_skill_slug: tpl.reward_skill_slug ?? null,
          cadence: tpl.cadence,
          expires_at,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      // Activity log: started
      await admin.from("coop_quest_events").insert({
        quest_id: created.id,
        pair_key: pk,
        actor_profile_id: profile_id,
        event_type: "started",
        progress_a: 0,
        progress_b: 0,
        note: `Started ${tpl.cadence} quest: ${tpl.title}`,
      });

      return new Response(JSON.stringify({ success: true, quest: created }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (op === "claim") {
      if (!quest_id) {
        return new Response(JSON.stringify({ success: false, error: "Missing quest_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: q } = await admin
        .from("coop_quests")
        .select("*")
        .eq("id", quest_id)
        .maybeSingle();
      if (!q) {
        return new Response(JSON.stringify({ success: false, error: "Quest not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (q.profile_a_id !== profile_id && q.profile_b_id !== profile_id) {
        return new Response(JSON.stringify({ success: false, error: "Not your quest" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!q.completed_at) {
        return new Response(JSON.stringify({ success: false, error: "Quest not yet completed by both players" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isA = q.profile_a_id === profile_id;
      if ((isA && q.claimed_by_a) || (!isA && q.claimed_by_b)) {
        return new Response(JSON.stringify({ success: false, error: "Already claimed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Award XP via experience_ledger
      await admin.from("experience_ledger").insert({
        user_id: user.id,
        profile_id,
        activity_type: "coop_quest_complete",
        xp_amount: q.reward_xp,
        metadata: {
          category: "social",
          action_key: "coop_quest_complete",
          quest_id: q.id,
          quest_key: q.quest_key,
          pending_daily_process: true,
        },
      });

      if (q.reward_skill_xp > 0 && q.reward_skill_slug) {
        await grantSkillXp(admin, profile_id, q.reward_skill_slug, q.reward_skill_xp);
      }

      const updates: any = isA ? { claimed_by_a: true } : { claimed_by_b: true };
      await admin.from("coop_quests").update(updates).eq("id", q.id);

      // Activity log: claimed
      await admin.from("coop_quest_events").insert({
        quest_id: q.id,
        pair_key: q.pair_key,
        actor_profile_id: profile_id,
        event_type: "claimed",
        progress_a: q.progress_a,
        progress_b: q.progress_b,
        note: `Claimed reward: +${q.reward_xp} XP${q.reward_skill_xp > 0 && q.reward_skill_slug ? ` · +${q.reward_skill_xp} ${q.reward_skill_slug} XP` : ""}`,
      });

      return new Response(JSON.stringify({
        success: true,
        reward_xp: q.reward_xp,
        reward_skill_xp: q.reward_skill_xp,
        reward_skill_slug: q.reward_skill_slug,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: `Unknown op: ${op}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("coop-quest error", err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
