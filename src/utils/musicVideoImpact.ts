/**
 * Music Video Impact Pipeline (v1.0.930)
 * Completed music videos cascade bonuses into fame, charts, streaming, and fan conversion.
 */

import { supabase } from "@/integrations/supabase/client";

export interface VideoImpactResult {
  fameBoosted: number;
  streamingBoost: number;       // percentage uplift on daily streams
  chartPositionBoost: number;   // raw points added to chart score
  fanConversionBoost: number;   // multiplier (1.0 = no bonus)
  hypeGenerated: number;
}

interface VideoMetrics {
  views: number;
  quality: number;        // 1-100
  productionBudget: number;
  hasChoreography: boolean;
  isCollaboration: boolean;
  genreTrendScore: number; // from genreTrends.ts
}

/**
 * Calculate cascading impact of a music video release.
 */
export function calculateVideoImpact(metrics: VideoMetrics): VideoImpactResult {
  const { views, quality, productionBudget, hasChoreography, isCollaboration, genreTrendScore } = metrics;

  // Base fame from views (diminishing returns)
  const viewFame = Math.floor(Math.sqrt(views) * 0.5);

  // Quality multiplier (50 quality = 1.0x, 100 quality = 2.0x)
  const qualityMult = 0.5 + (quality / 100) * 1.5;

  // Production budget tier bonus
  const budgetBonus = productionBudget >= 50000 ? 1.5
    : productionBudget >= 10000 ? 1.2
    : productionBudget >= 1000 ? 1.1
    : 1.0;

  const choreographyBonus = hasChoreography ? 1.15 : 1.0;
  const collabBonus = isCollaboration ? 1.25 : 1.0;

  const fameBoosted = Math.round(
    viewFame * qualityMult * budgetBonus * choreographyBonus * collabBonus * genreTrendScore
  );

  // Streaming boost: high-quality videos drive 5-30% more daily streams
  const streamingBoost = Math.min(30, Math.round(
    (quality / 100) * 15 + (views > 100000 ? 10 : views > 10000 ? 5 : 0)
  ) * genreTrendScore);

  // Chart position boost
  const chartPositionBoost = Math.round(
    (fameBoosted * 0.1) + (quality > 80 ? 50 : quality > 60 ? 20 : 0)
  );

  // Fan conversion boost from viral videos
  const viralThreshold = views > 500000;
  const fanConversionBoost = viralThreshold
    ? 1.0 + Math.min(0.5, views / 2000000)
    : 1.0 + Math.min(0.15, quality / 800);

  // Hype generated
  const hypeGenerated = Math.round(fameBoosted * 0.3 + views / 500);

  return {
    fameBoosted,
    streamingBoost: parseFloat(streamingBoost.toFixed(1)),
    chartPositionBoost,
    fanConversionBoost: parseFloat(fanConversionBoost.toFixed(3)),
    hypeGenerated,
  };
}

/**
 * Apply video impact to a song's release record.
 */
export async function applyVideoImpactToSong(
  songId: string,
  bandId: string,
  impact: VideoImpactResult
): Promise<void> {
  // Update band fame
  const { data: band } = await supabase
    .from("bands")
    .select("fame")
    .eq("id", bandId)
    .single();

  if (band) {
    await supabase
      .from("bands")
      .update({ fame: (band.fame || 0) + impact.fameBoosted })
      .eq("id", bandId);
  }

  // Log fame event
  await supabase.from("band_fame_events").insert({
    band_id: bandId,
    event_type: "music_video_release",
    fame_gained: impact.fameBoosted,
    event_data: {
      song_id: songId,
      streaming_boost_pct: impact.streamingBoost,
      chart_boost: impact.chartPositionBoost,
      hype: impact.hypeGenerated,
    },
  });

  // Add hype to the song's release
  const { data: release } = await supabase
    .from("song_releases")
    .select("id, total_streams")
    .eq("song_id", songId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (release) {
    // Boost streams as proxy for video hype impact
    const currentStreams = release.total_streams || 0;
    const streamBoost = Math.round(currentStreams * (impact.streamingBoost / 100));
    await supabase
      .from("song_releases")
      .update({ total_streams: currentStreams + streamBoost } as any)
      .eq("id", release.id);
  }
}
