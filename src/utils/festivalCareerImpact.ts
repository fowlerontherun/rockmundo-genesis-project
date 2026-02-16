import { supabase } from "@/integrations/supabase/client";

/**
 * Festival Career Impact System (v1.0.770)
 * 
 * Handles fame/fan growth, chart boosts, and streaming multipliers
 * that result from festival performances, scaled by slot type.
 */

// Slot-type multipliers for fame, fans, and streaming boosts
const SLOT_MULTIPLIERS: Record<string, { fame: number; fans: number; streams: number; chartBoost: number }> = {
  headliner: { fame: 3.0, fans: 2.5, streams: 2.0, chartBoost: 1.5 },
  headline: { fame: 3.0, fans: 2.5, streams: 2.0, chartBoost: 1.5 },
  main: { fame: 2.0, fans: 1.8, streams: 1.5, chartBoost: 1.25 },
  support: { fame: 1.5, fans: 1.3, streams: 1.2, chartBoost: 1.1 },
  opener: { fame: 1.0, fans: 1.0, streams: 1.0, chartBoost: 1.0 },
  opening: { fame: 1.0, fans: 1.0, streams: 1.0, chartBoost: 1.0 },
};

export interface FestivalCareerImpactInput {
  bandId: string;
  festivalId: string;
  performanceScore: number; // 0-100
  crowdEnergyAvg: number;  // 0-100
  slotType: string;
  attendanceEstimate: number;
  songsPerformedIds?: string[];
}

export interface FestivalCareerImpactResult {
  fameGained: number;
  newFansGained: number;
  casualFans: number;
  dedicatedFans: number;
  superfans: number;
  songsBosted: number;
  streamingMultiplier: number;
  chartBoostMultiplier: number;
  chartBoostExpiresAt: string;
}

/**
 * Apply all career impacts from a festival performance.
 * Returns a summary of what was gained.
 */
export async function applyFestivalCareerImpact(
  input: FestivalCareerImpactInput
): Promise<FestivalCareerImpactResult> {
  const slot = SLOT_MULTIPLIERS[input.slotType] || SLOT_MULTIPLIERS.opener;
  const scoreRatio = input.performanceScore / 100;
  const energyRatio = input.crowdEnergyAvg / 100;
  const combinedRatio = (scoreRatio * 0.6 + energyRatio * 0.4); // performance weighted more

  // ── 1. FAME GROWTH ──
  const baseFame = 200;
  const fameGained = Math.round(baseFame * slot.fame * combinedRatio * (1 + input.attendanceEstimate / 20000));

  // ── 2. FAN CONVERSION ──
  const baseFanRate = 0.04; // 4% of attendance become fans
  const fanRate = baseFanRate * slot.fans * combinedRatio;
  const newFansGained = Math.max(1, Math.floor(input.attendanceEstimate * fanRate));

  // Distribute into tiers based on performance score
  const superfanRate = input.performanceScore >= 85 ? 0.12 : input.performanceScore >= 70 ? 0.06 : 0.02;
  const dedicatedRate = input.performanceScore >= 70 ? 0.25 : input.performanceScore >= 50 ? 0.15 : 0.08;
  const casualRate = 1 - superfanRate - dedicatedRate;

  const superfans = Math.floor(newFansGained * superfanRate);
  const dedicatedFans = Math.floor(newFansGained * dedicatedRate);
  const casualFans = newFansGained - superfans - dedicatedFans;

  // ── 3. CHART BOOST & STREAMING MULTIPLIER for performed songs ──
  const streamingMultiplier = 1 + (slot.streams - 1) * combinedRatio; // e.g. 1.0 - 2.0
  const chartBoostMultiplier = 1 + (slot.chartBoost - 1) * combinedRatio;
  // Boost lasts 7 days for headliners, 5 for support, 3 for openers
  const boostDays = input.slotType === "headliner" || input.slotType === "headline" ? 7
    : input.slotType === "main" ? 6
    : input.slotType === "support" ? 5 : 3;
  const chartBoostExpiresAt = new Date(Date.now() + boostDays * 24 * 60 * 60 * 1000).toISOString();

  // ── PERSIST: Update band fame & fans ──
  const { data: band } = await supabase
    .from("bands")
    .select("fame, total_fans, casual_fans, dedicated_fans, superfans")
    .eq("id", input.bandId)
    .single();

  if (band) {
    await supabase
      .from("bands")
      .update({
        fame: (band.fame || 0) + fameGained,
        total_fans: (band.total_fans || 0) + newFansGained,
        casual_fans: (band.casual_fans || 0) + casualFans,
        dedicated_fans: (band.dedicated_fans || 0) + dedicatedFans,
        superfans: (band.superfans || 0) + superfans,
      })
      .eq("id", input.bandId);
  }

  // ── PERSIST: Log fame event ──
  await supabase.from("band_fame_events").insert({
    band_id: input.bandId,
    event_type: "festival_performance",
    fame_gained: fameGained,
    event_data: {
      festival_id: input.festivalId,
      slot_type: input.slotType,
      performance_score: input.performanceScore,
      crowd_energy_avg: input.crowdEnergyAvg,
      attendance_estimate: input.attendanceEstimate,
      fans_gained: newFansGained,
      streaming_multiplier: streamingMultiplier,
      chart_boost_multiplier: chartBoostMultiplier,
      chart_boost_expires_at: chartBoostExpiresAt,
    },
  });

  // ── PERSIST: Apply streaming/chart boosts to performed songs ──
  let songsBoosted = 0;
  if (input.songsPerformedIds && input.songsPerformedIds.length > 0) {
    for (const songId of input.songsPerformedIds) {
      // Update song fame, popularity, and gig_play_count
      const { data: song } = await supabase
        .from("songs")
        .select("id, popularity, fame, gig_play_count")
        .eq("id", songId)
        .single();

      if (song) {
        const popGain = Math.round(15 * slot.fame * combinedRatio);
        const fameGain = Math.round(10 * slot.fame * combinedRatio);

        await supabase
          .from("songs")
          .update({
            popularity: Math.min(1000, ((song as any).popularity || 0) + popGain),
            fame: ((song as any).fame || 0) + fameGain,
            gig_play_count: ((song as any).gig_play_count || 0) + 1,
            last_gigged_at: new Date().toISOString(),
          })
          .eq("id", songId);

        songsBoosted++;
      }
    }

    // Store temporary streaming/chart multiplier on song_releases for performed songs
    const { data: releases } = await supabase
      .from("song_releases")
      .select("id, song_id")
      .in("song_id", input.songsPerformedIds);

    if (releases && releases.length > 0) {
      for (const release of releases) {
        await supabase
          .from("song_releases")
          .update({
            festival_stream_multiplier: streamingMultiplier,
            festival_chart_boost: chartBoostMultiplier,
            festival_boost_expires_at: chartBoostExpiresAt,
          } as any)
          .eq("id", release.id);
      }
    }
  }

  return {
    fameGained,
    newFansGained,
    casualFans,
    dedicatedFans,
    superfans,
    songsBosted: songsBoosted,
    streamingMultiplier: Math.round(streamingMultiplier * 100) / 100,
    chartBoostMultiplier: Math.round(chartBoostMultiplier * 100) / 100,
    chartBoostExpiresAt,
  };
}
