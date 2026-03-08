/**
 * Cross-Band Collaboration System (v1.0.930)
 * Allows bands to create featured songs together with shared fame and revenue.
 */

import { supabase } from "@/integrations/supabase/client";

export interface CollaborationProposal {
  fromBandId: string;
  toBandId: string;
  songId?: string;        // existing song to feature on, or null for new co-write
  proposedSplit: number;  // 0-100 percentage for the initiating band
  message?: string;
}

export interface CollaborationBonus {
  fameMultiplier: number;          // combined audience boost
  streamMultiplier: number;        // cross-pollination effect
  fanCrossoverPercent: number;     // % of other band's fans exposed
  chartBoost: number;              // bonus chart points
}

/**
 * Calculate the bonuses from a collaboration based on both bands' stats.
 */
export function calculateCollaborationBonus(
  band1Fame: number,
  band2Fame: number,
  band1Fans: number,
  band2Fans: number,
  genreMatch: boolean
): CollaborationBonus {
  const fameRatio = Math.min(band1Fame, band2Fame) / Math.max(band1Fame, band2Fame, 1);

  // Closer fame = better synergy (0.5 – 1.5)
  const synergyScore = 0.5 + fameRatio;

  // Fame multiplier: collaborations always boost fame
  const fameMultiplier = 1.2 + (synergyScore - 0.5) * 0.3;

  // Stream multiplier: cross-audience discovery
  const streamMultiplier = 1.15 + (genreMatch ? 0.15 : 0.05);

  // Fan crossover: 5-15% of the partner's fans get exposed
  const fanCrossoverPercent = genreMatch
    ? Math.min(15, 5 + fameRatio * 10)
    : Math.min(8, 3 + fameRatio * 5);

  // Chart boost from combined hype
  const combinedFame = band1Fame + band2Fame;
  const chartBoost = Math.round(Math.sqrt(combinedFame) * 0.5 * (genreMatch ? 1.2 : 1.0));

  return {
    fameMultiplier: parseFloat(fameMultiplier.toFixed(2)),
    streamMultiplier: parseFloat(streamMultiplier.toFixed(2)),
    fanCrossoverPercent: parseFloat(fanCrossoverPercent.toFixed(1)),
    chartBoost,
  };
}

/**
 * Check if two bands are eligible to collaborate.
 * Requirements: both active, not on hiatus, at least one band member has friendship with other band.
 */
export async function checkCollaborationEligibility(
  band1Id: string,
  band2Id: string
): Promise<{ eligible: boolean; reason?: string }> {
  // Check both bands are active
  const { data: bands } = await supabase
    .from("bands")
    .select("id, status, name")
    .in("id", [band1Id, band2Id]);

  if (!bands || bands.length !== 2) {
    return { eligible: false, reason: "One or both bands not found" };
  }

  const inactive = bands.find(b => b.status !== "active");
  if (inactive) {
    return { eligible: false, reason: `${inactive.name} is not currently active` };
  }

  // Check for member-level friendship between bands
  const { data: members1 } = await supabase
    .from("band_members")
    .select("user_id")
    .eq("band_id", band1Id);

  const { data: members2 } = await supabase
    .from("band_members")
    .select("user_id")
    .eq("band_id", band2Id);

  if (!members1?.length || !members2?.length) {
    return { eligible: false, reason: "Band member data unavailable" };
  }

  const userIds1 = members1.map(m => m.user_id).filter(Boolean) as string[];
  const userIds2 = members2.map(m => m.user_id).filter(Boolean) as string[];

  // Check if any cross-band friendships exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const friendshipsQuery: any = supabase
    .from("friendships")
    .select("id")
    .in("user_id", userIds1)
    .in("friend_id", userIds2)
    .eq("status", "accepted")
    .limit(1);
  const { data: friendships } = await friendshipsQuery;

  if (!friendships?.length) {
    return { eligible: false, reason: "No friendships between band members — get to know each other first!" };
  }

  return { eligible: true };
}

/**
 * Apply fan crossover effect after a collaboration song is released.
 */
export async function applyFanCrossover(
  band1Id: string,
  band2Id: string,
  crossoverPercent: number
): Promise<{ band1FansGained: number; band2FansGained: number }> {
  const { data: band1 } = await supabase
    .from("bands")
    .select("total_fans, casual_fans")
    .eq("id", band1Id)
    .single();

  const { data: band2 } = await supabase
    .from("bands")
    .select("total_fans, casual_fans")
    .eq("id", band2Id)
    .single();

  const rate = crossoverPercent / 100;
  const band1Gains = Math.floor((band2?.total_fans || 0) * rate);
  const band2Gains = Math.floor((band1?.total_fans || 0) * rate);

  // Add as casual fans
  if (band1Gains > 0) {
    await supabase
      .from("bands")
      .update({
        casual_fans: (band1?.casual_fans || 0) + band1Gains,
        total_fans: (band1?.total_fans || 0) + band1Gains,
      })
      .eq("id", band1Id);
  }

  if (band2Gains > 0) {
    await supabase
      .from("bands")
      .update({
        casual_fans: (band2?.casual_fans || 0) + band2Gains,
        total_fans: (band2?.total_fans || 0) + band2Gains,
      })
      .eq("id", band2Id);
  }

  return { band1FansGained: band1Gains, band2FansGained: band2Gains };
}
