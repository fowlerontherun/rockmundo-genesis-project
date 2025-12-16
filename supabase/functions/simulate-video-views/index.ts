import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let videosUpdated = 0;
  let totalViews = 0;
  let totalEarnings = 0;

  try {
    runId = await startJobRun({
      jobName: "simulate-video-views",
      functionName: "simulate-video-views",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    // Get released videos
    const { data: releasedVideos, error: fetchError } = await supabaseClient
      .from("music_videos")
      .select(`
        id,
        song_id,
        title,
        production_quality,
        release_date,
        views_count,
        earnings,
        hype_score,
        songs(id, title, quality_score, hype, band_id, user_id)
      `)
      .eq("status", "released");

    if (fetchError) throw fetchError;

    console.log(`Processing ${releasedVideos?.length || 0} released videos`);

    const now = new Date();

    for (const video of releasedVideos || []) {
      const releaseDate = new Date(video.release_date || video.created_at);
      const daysSinceRelease = Math.max(1, (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // View calculation based on:
      // - Production quality
      // - Song quality/hype
      // - Days since release (decay factor)
      // - Random viral chance
      
      const song = video.songs as any;
      const qualityMult = (video.production_quality || 50) / 100;
      const songHype = (song?.hype || 0);
      const songQuality = (song?.quality_score || 50) / 100;
      
      // Decay factor - videos get fewer new views over time
      const decayFactor = Math.max(0.1, 1 - (daysSinceRelease / 60)); // 60 days to 10%
      
      // Base daily views based on quality
      let baseViews = 100 + (video.production_quality || 50) * 10 + songHype;
      
      // Apply multipliers
      baseViews *= qualityMult * songQuality * decayFactor;
      
      // Random viral chance (1% chance of 5-10x views)
      const isViral = Math.random() < 0.01;
      if (isViral) {
        baseViews *= 5 + Math.random() * 5;
      }
      
      // Add variance
      const variance = 0.7 + Math.random() * 0.6;
      const dailyViews = Math.round(baseViews * variance);
      
      // Calculate earnings ($0.002 per view on average)
      const dailyEarnings = Math.round(dailyViews * 0.002 * 100) / 100;
      
      // Update hype based on view velocity
      const viewVelocity = dailyViews / Math.max(1, video.views_count || 1);
      const hypeChange = isViral ? 10 : (viewVelocity > 0.1 ? 2 : (viewVelocity > 0.01 ? 0 : -1));
      const newHype = Math.max(0, Math.min(100, (video.hype_score || 0) + hypeChange));

      // Update video
      const { error: updateError } = await supabaseClient
        .from("music_videos")
        .update({
          views_count: (video.views_count || 0) + dailyViews,
          earnings: (video.earnings || 0) + dailyEarnings,
          hype_score: newHype,
        })
        .eq("id", video.id);

      if (updateError) {
        console.error("Error updating video:", updateError);
        continue;
      }

      // Update song hype
      if (song?.id) {
        await supabaseClient
          .from("songs")
          .update({ hype: (song.hype || 0) + Math.round(dailyViews * 0.01) })
          .eq("id", song.id);
      }

      // Credit earnings to user
      if (song?.user_id && dailyEarnings > 0) {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("cash, fans")
          .eq("user_id", song.user_id)
          .single();

        if (profile) {
          const newFans = Math.round(dailyViews * 0.001); // 0.1% of viewers become fans
          await supabaseClient
            .from("profiles")
            .update({ 
              cash: (profile.cash || 0) + dailyEarnings,
              fans: (profile.fans || 0) + newFans,
            })
            .eq("user_id", song.user_id);
        }
      }

      // Credit to band balance
      if (song?.band_id && dailyEarnings > 0) {
        const { data: band } = await supabaseClient
          .from("bands")
          .select("band_balance, weekly_fans")
          .eq("id", song.band_id)
          .single();

        if (band) {
          await supabaseClient
            .from("bands")
            .update({ 
              band_balance: (band.band_balance || 0) + dailyEarnings * 0.7, // 70% to band
              weekly_fans: (band.weekly_fans || 0) + Math.round(dailyViews * 0.001),
            })
            .eq("id", song.band_id);
        }
      }

      videosUpdated++;
      totalViews += dailyViews;
      totalEarnings += dailyEarnings;

      if (isViral) {
        console.log(`Video "${video.title}" went viral! ${dailyViews} views today`);
      }
    }

    console.log(`Updated ${videosUpdated} videos, ${totalViews} total views, $${totalEarnings.toFixed(2)} earnings`);

    await completeJobRun({
      jobName: "simulate-video-views",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: videosUpdated,
      resultSummary: { videosUpdated, totalViews, totalEarnings },
    });

    return new Response(
      JSON.stringify({ success: true, videosUpdated, totalViews, totalEarnings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await failJobRun({
      jobName: "simulate-video-views",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { videosUpdated, totalViews, totalEarnings },
    });

    console.error("Error simulating video views:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
