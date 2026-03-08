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

    // === FETCH BAND SENTIMENT & REPUTATION FOR VIDEO ENGAGEMENT (v1.0.951 / v1.0.988) ===
    const bandSentimentMap = new Map<string, number>();
    const bandReputationMap = new Map<string, number>();
    const bandIds = new Set<string>();
    for (const v of releasedVideos || []) {
      const song = v.songs as any;
      if (song?.band_id) bandIds.add(song.band_id);
    }
    if (bandIds.size > 0) {
      try {
        const { data: bandExtras } = await supabaseClient
          .from('bands')
          .select('id, fan_sentiment_score, reputation_score')
          .in('id', Array.from(bandIds));
        for (const b of bandExtras || []) {
          bandSentimentMap.set(b.id, (b as any).fan_sentiment_score ?? 0);
          bandReputationMap.set(b.id, (b as any).reputation_score ?? 0);
        }
      } catch (e) {
        console.error("Error fetching band sentiment/reputation for videos:", e);
      }
    }

    const sentimentEventInserts: any[] = [];
    const now = new Date();

    for (const video of releasedVideos || []) {
      const releaseDate = new Date(video.release_date || video.created_at);
      const daysSinceRelease = Math.max(1, (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
      
      const song = video.songs as any;
      const qualityMult = (video.production_quality || 50) / 100;
      const songHype = (song?.hype || 0);
      const songQuality = (song?.quality_score || 50) / 100;
      
      // Decay factor - videos get fewer new views over time
      const decayFactor = Math.max(0.1, 1 - (daysSinceRelease / 60));
      
      // Base daily views based on quality
      let baseViews = 100 + (video.production_quality || 50) * 10 + songHype;
      
      // === SENTIMENT VIDEO VIEWS MODIFIER (v1.0.951) ===
      const sentimentScore = song?.band_id ? (bandSentimentMap.get(song.band_id) ?? 0) : 0;
      const sentimentT = (Math.max(-100, Math.min(100, sentimentScore)) + 100) / 200;
      const videoViewsMod = parseFloat((0.6 + sentimentT * 0.8).toFixed(2)); // 0.6x to 1.4x

      // === REPUTATION → VIDEO VIEWS (v1.0.988) ===
      // Respected/iconic artists get more clicks; toxic artists get fewer organic views
      const vidRepScore = song?.band_id ? (bandReputationMap.get(song.band_id) ?? 0) : 0;
      const vidRepT = (Math.max(-100, Math.min(100, vidRepScore)) + 100) / 200;
      const videoRepMod = parseFloat((0.8 + vidRepT * 0.4).toFixed(2)); // 0.8x–1.2x

      // Apply multipliers
      baseViews *= qualityMult * songQuality * decayFactor * videoViewsMod * videoRepMod;
      
      // Random viral chance (1% chance of 5-10x views, boosted by positive sentiment)
      const viralChance = 0.01 + (sentimentT > 0.7 ? (sentimentT - 0.7) * 0.03 : 0); // up to 1.9%
      const isViral = Math.random() < viralChance;
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
          const newFans = Math.round(dailyViews * 0.001);
          await supabaseClient
            .from("profiles")
            .update({ 
              cash: (profile.cash || 0) + dailyEarnings,
              fans: (profile.fans || 0) + newFans,
            })
            .eq("user_id", song.user_id);
        }
      }

      // Credit to band balance and create earnings record
      if (song?.band_id && dailyEarnings > 0) {
        const bandShare = Math.round(dailyEarnings * 0.7);
        
        if (bandShare <= 0) continue;

        const { data: band } = await supabaseClient
          .from("bands")
          .select("band_balance, weekly_fans, fan_sentiment_score")
          .eq("id", song.band_id)
          .single();

        if (band) {
          // Viral videos boost sentiment (v1.0.951)
          let sentimentBoost = 0;
          if (isViral) sentimentBoost = 5;
          else if (dailyViews > 10000) sentimentBoost = 2;
          else if (dailyViews > 1000) sentimentBoost = 1;

          const currentSentiment = (band as any).fan_sentiment_score ?? 0;
          const newSentiment = Math.max(-100, Math.min(100, currentSentiment + sentimentBoost));

          const bandUpdate: any = {
            band_balance: (band.band_balance || 0) + bandShare,
            weekly_fans: (band.weekly_fans || 0) + Math.round(dailyViews * 0.001),
          };
          if (sentimentBoost > 0) {
            bandUpdate.fan_sentiment_score = newSentiment;
          }

          // === MORALE BOOST: Video views feel rewarding (v1.0.968) ===
          const videoMoraleBoost = isViral ? 6 : dailyViews > 10000 ? 3 : dailyViews > 1000 ? 2 : 0;
          if (videoMoraleBoost > 0) {
            const { data: moraleBand } = await supabaseClient.from('bands').select('morale').eq('id', song.band_id).single();
            bandUpdate.morale = Math.min(100, ((moraleBand as any)?.morale ?? 50) + videoMoraleBoost);
          }

          await supabaseClient
            .from("bands")
            .update(bandUpdate)
            .eq("id", song.band_id);

          if (sentimentBoost > 0) {
            sentimentEventInserts.push({
              band_id: song.band_id,
              event_type: isViral ? 'viral_video' : 'music_video_views',
              sentiment_change: sentimentBoost,
              media_intensity_change: isViral ? 5 : 1,
              sentiment_after: newSentiment,
              source: 'simulate-video-views',
              description: isViral 
                ? `🔥 "${video.title}" went viral with ${dailyViews.toLocaleString()} views!`
                : `"${video.title}" gained ${dailyViews.toLocaleString()} views`,
            });
          }

          // Create band_earnings record for tracking
          const { error: earningsError } = await supabaseClient
            .from("band_earnings")
            .insert({
              band_id: song.band_id,
              amount: bandShare,
              source: "music_video",
              description: `Music video views: ${video.title || "Video"}`,
              earned_by_user_id: song.user_id || null,
              metadata: { 
                video_id: video.id, 
                daily_views: dailyViews,
                song_id: song.id,
              },
            });

          if (earningsError) {
            console.error("Error inserting band_earnings for video:", video.id, earningsError);
          }
        }
      }

      videosUpdated++;
      totalViews += dailyViews;
      totalEarnings += dailyEarnings;

      if (isViral) {
        console.log(`Video "${video.title}" went viral! ${dailyViews} views today`);
      }
    }

    // Batch insert sentiment events (v1.0.951)
    if (sentimentEventInserts.length > 0) {
      await supabaseClient.from('band_sentiment_events').insert(sentimentEventInserts);
      console.log(`Logged ${sentimentEventInserts.length} video sentiment events`);
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
