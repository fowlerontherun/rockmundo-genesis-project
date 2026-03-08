/**
 * Fan Loyalty Decay System (v1.0.930)
 * Fans churn when a band goes inactive. Activity (gigs, releases, social media) prevents decay.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DecayResult {
  casualFansLost: number;
  dedicatedDowngraded: number;  // dedicated → casual
  superfansDowngraded: number;  // superfan → dedicated
  totalChurn: number;
  daysSinceActivity: number;
}

// Decay starts after this many days of inactivity
const GRACE_PERIOD_DAYS = 7;

// Per-day decay rates after grace period
const CASUAL_DAILY_DECAY = 0.02;      // 2% per day
const DEDICATED_DAILY_DOWNGRADE = 0.005; // 0.5% per day
const SUPERFAN_DAILY_DOWNGRADE = 0.002;  // 0.2% per day

// Fame-based protection (higher fame = slower decay)
function getFameProtection(fame: number): number {
  if (fame >= 10000) return 0.3;  // 70% slower decay
  if (fame >= 5000) return 0.2;
  if (fame >= 1000) return 0.1;
  return 0;
}

/**
 * Calculate fan decay for a band based on days since last activity.
 */
export function calculateFanDecay(
  casualFans: number,
  dedicatedFans: number,
  superfans: number,
  daysSinceActivity: number,
  fame: number
): DecayResult {
  if (daysSinceActivity <= GRACE_PERIOD_DAYS) {
    return {
      casualFansLost: 0,
      dedicatedDowngraded: 0,
      superfansDowngraded: 0,
      totalChurn: 0,
      daysSinceActivity,
    };
  }

  const activeDays = daysSinceActivity - GRACE_PERIOD_DAYS;
  const protection = getFameProtection(fame);
  const decayMult = 1 - protection;

  // Cumulative decay (compounding)
  const casualLost = Math.floor(
    casualFans * (1 - Math.pow(1 - CASUAL_DAILY_DECAY * decayMult, activeDays))
  );
  const dedicatedDown = Math.floor(
    dedicatedFans * (1 - Math.pow(1 - DEDICATED_DAILY_DOWNGRADE * decayMult, activeDays))
  );
  const superfanDown = Math.floor(
    superfans * (1 - Math.pow(1 - SUPERFAN_DAILY_DOWNGRADE * decayMult, activeDays))
  );

  return {
    casualFansLost: casualLost,
    dedicatedDowngraded: dedicatedDown,
    superfansDowngraded: superfanDown,
    totalChurn: casualLost + dedicatedDown + superfanDown,
    daysSinceActivity,
  };
}

/**
 * Get days since band's last significant activity.
 */
export async function getDaysSinceLastActivity(bandId: string): Promise<number> {
  // Check most recent gig, release, or social media post
  const checks = await Promise.all([
    supabase
      .from("gigs")
      .select("performance_date")
      .eq("band_id", bandId)
      .eq("status", "completed")
      .order("performance_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("song_releases")
      .select("release_date")
      .eq("band_id", bandId)
      .order("release_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("band_fame_events")
      .select("created_at")
      .eq("band_id", bandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const dates = checks
    .map(c => c.data)
    .filter(Boolean)
    .map(d => {
      const val = (d as any).performance_date || (d as any).release_date || (d as any).created_at;
      return val ? new Date(val).getTime() : 0;
    })
    .filter(t => t > 0);

  if (dates.length === 0) return 30; // default high inactivity

  const mostRecent = Math.max(...dates);
  const daysSince = Math.floor((Date.now() - mostRecent) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysSince);
}

/**
 * Apply fan decay to a band's stats in the database.
 */
export async function applyFanDecay(bandId: string): Promise<DecayResult | null> {
  const { data: band } = await supabase
    .from("bands")
    .select("casual_fans, dedicated_fans, superfans, fame, total_fans")
    .eq("id", bandId)
    .single();

  if (!band) return null;

  const daysSince = await getDaysSinceLastActivity(bandId);
  const decay = calculateFanDecay(
    band.casual_fans || 0,
    band.dedicated_fans || 0,
    band.superfans || 0,
    daysSince,
    band.fame || 0
  );

  if (decay.totalChurn === 0) return decay;

  // Apply: casual fans lost completely, downgraded fans shift tier
  const newCasual = Math.max(0, (band.casual_fans || 0) - decay.casualFansLost + decay.dedicatedDowngraded);
  const newDedicated = Math.max(0, (band.dedicated_fans || 0) - decay.dedicatedDowngraded + decay.superfansDowngraded);
  const newSuperfans = Math.max(0, (band.superfans || 0) - decay.superfansDowngraded);
  const newTotal = newCasual + newDedicated + newSuperfans;

  await supabase
    .from("bands")
    .update({
      casual_fans: newCasual,
      dedicated_fans: newDedicated,
      superfans: newSuperfans,
      total_fans: newTotal,
    })
    .eq("id", bandId);

  return decay;
}
