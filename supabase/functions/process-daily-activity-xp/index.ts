import { serve } from "../_shared/deno/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import type { Database } from "../../../src/types/database-fallback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Activity type to AP rate mapping (40-60% of XP)
const ACTIVITY_AP_RATES: Record<string, number> = {
  exercise: 0.60,
  therapy: 0.60,
  meditation: 0.55,
  mentor_session: 0.55,
  busking_session: 0.50,
  gig_performance: 0.50,
  rest: 0.50,
  nutrition: 0.50,
  university_attendance: 0.45,
  book_reading: 0.45,
  recording_complete: 0.40,
  youtube_video: 0.40,
  travel: 0.40,
  admin_grant: 0.50,
  birthday_reward: 0.50,
  weekly_bonus: 0.50,
};

const DEFAULT_AP_RATE = 0.50;
const DAILY_ACTIVITY_XP_CAP = 250;
const DAILY_ACTIVITY_AP_CAP = 20; // Hard cap on AP from activities (stipend can add up to 30 more → 50 max total)

function getApRateForActivity(activityType: string): number {
  return ACTIVITY_AP_RATES[activityType] ?? DEFAULT_AP_RATE;
}

interface ActivitySummary {
  profileId: string;
  totalXp: number;
  totalAp: number;
  activities: { type: string; xp: number; ap: number }[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Calculate yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    const grantDate = yesterday.toISOString().slice(0, 10);

    console.log(`[ProcessDailyActivityXp] Processing activities for ${grantDate}`);

    // Page the entire ledger; PostgREST defaults to a truncated 1,000-row result.
    const activities: Array<{profile_id:string|null;activity_type:string|null;xp_amount:number|null}> = [];
    for (let offset = 0; ; offset += 500) {
      const { data: page, error: activitiesError } = await client
        .from("experience_ledger")
        .select("profile_id, activity_type, xp_amount")
        .gte("created_at", yesterday.toISOString())
        .lte("created_at", yesterdayEnd.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + 499);
      if (activitiesError) throw new Error(`Failed to fetch activities: ${activitiesError.message}`);
      activities.push(...(page ?? []));
      if (!page || page.length < 500) break;
    }

    if (!activities || activities.length === 0) {
      console.log("[ProcessDailyActivityXp] No activities to process");
      return new Response(
        JSON.stringify({ success: true, message: "No activities to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group activities by profile
    const profileActivities = new Map<string, ActivitySummary>();

    for (const activity of activities) {
      if (!activity.profile_id) continue;

      const existing = profileActivities.get(activity.profile_id);
      const apAmount = Math.floor((activity.xp_amount || 0) * getApRateForActivity(activity.activity_type || ""));

      if (existing) {
        existing.totalXp += activity.xp_amount || 0;
        existing.totalAp += apAmount;
        existing.activities.push({
          type: activity.activity_type || "unknown",
          xp: activity.xp_amount || 0,
          ap: apAmount,
        });
      } else {
        profileActivities.set(activity.profile_id, {
          profileId: activity.profile_id,
          totalXp: activity.xp_amount || 0,
          totalAp: apAmount,
          activities: [{
            type: activity.activity_type || "unknown",
            xp: activity.xp_amount || 0,
            ap: apAmount,
          }],
        });
      }
    }

    console.log(`[ProcessDailyActivityXp] Found ${profileActivities.size} profiles with activity`);

    let processed = 0;
    let skipped = 0;

    for (const [profileId, summary] of profileActivities) {
      const cappedSxp = Math.max(0, Math.min(DAILY_ACTIVITY_XP_CAP, summary.totalXp));
      const cappedAp = Math.max(0, Math.min(DAILY_ACTIVITY_AP_CAP, summary.totalAp));
      if (cappedSxp === 0) { skipped++; continue; }

      // One database transaction owns both the idempotency marker and
      // arithmetic wallet increment. No stale read/modify/write or double pay.
      const { data: awarded, error: awardError } = await client.rpc("award_daily_activity_xp_atomic", {
        p_profile_id: profileId,
        p_grant_date: grantDate,
        p_xp: cappedSxp,
        p_ap: cappedAp,
        p_metadata: {
          raw_xp: summary.totalXp,
          total_ap: summary.totalAp,
          activity_count: summary.activities.length,
          activities: summary.activities,
        },
      });
      if (awardError) throw new Error(`Failed to award daily activity XP for ${profileId}: ${awardError.message}`);
      if (!awarded) { skipped++; continue; }
      processed++;
    }

    console.log(`[ProcessDailyActivityXp] Processed: ${processed}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processed} profiles, skipped ${skipped} already processed`,
        processed,
        skipped,
        date: grantDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ProcessDailyActivityXp] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
