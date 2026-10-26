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
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-triggered-by",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  // This function credits real game balances and must never be publicly runnable.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Server unavailable" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const client = createClient(supabaseUrl, serviceRoleKey);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer !== serviceRoleKey) {
    const cronToken = req.headers.get("x-cron-secret");
    if (!cronToken || cronToken.length < 32) {
      return new Response(JSON.stringify({ error: "Privileged authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: verified, error: verificationError } = await client.rpc(
      "verify_internal_cron_secret", { p_secret: cronToken },
    );
    if (verificationError || verified !== true) {
      return new Response(JSON.stringify({ error: "Invalid scheduler authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;
  const runDate = new Date().toISOString().slice(0, 10);
  const startedAt = Date.now();
  let runId: string | null = null;
  let claimedVideoId: string | null = null;
  try {
    // One video per invocation. The claim RPC refuses historical days when the
    // legacy worker may already have incremented views without paying royalties.
    const { data: nextVideo, error: claimError } = await client.rpc(
      "claim_next_daily_video", { p_day: runDate },
    );
    if (claimError) throw claimError;
    if (!nextVideo) {
      return new Response(JSON.stringify({
        success: true, alreadyProcessed: true, runDate,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    claimedVideoId = nextVideo;
    runId = await startJobRun({
      jobName: "simulate-video-views",
      functionName: "simulate-video-views",
      supabaseClient: client,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const { data: video, error: videoError } = await client.from("music_videos")
      .select("id, song_id, title, production_quality, release_date, created_at, views_count, hype_score, songs!inner(id, quality_score, hype, band_id, profile_id)")
      .eq("id", claimedVideoId)
      .single();
    if (videoError) throw videoError;
    if (!video) throw new Error("Claimed video was not found");

    const song = video.songs as {
      id: string;
      quality_score: number | null;
      hype: number | null;
      band_id: string | null;
      profile_id: string | null;
    };
    let sentiment = 0;
    let reputation = 0;
    if (song?.band_id) {
      const { data: band, error: bandError } = await client.from("bands")
        .select("fan_sentiment_score, reputation_score")
        .eq("id", song.band_id).single();
      if (bandError) throw bandError;
      sentiment = Number(band?.fan_sentiment_score ?? 0);
      reputation = Number(band?.reputation_score ?? 0);
    }

    const releaseDate = new Date(video.release_date || video.created_at);
    const ageDays = Math.max(1, (Date.now() - releaseDate.getTime()) / 86400000);
    const qualityMultiplier = Number(video.production_quality || 50) / 100;
    const songQualityMultiplier = Number(song?.quality_score || 50) / 100;
    const decayFactor = Math.max(0.1, 1 - ageDays / 60);
    const sentimentT = (Math.max(-100, Math.min(100, sentiment)) + 100) / 200;
    const reputationT = (Math.max(-100, Math.min(100, reputation)) + 100) / 200;
    const sentimentMultiplier = Number((0.6 + sentimentT * 0.8).toFixed(2));
    const reputationMultiplier = Number((0.8 + reputationT * 0.4).toFixed(2));
    let baseViews = (100 + Number(video.production_quality || 50) * 10 + Number(song?.hype || 0))
      * qualityMultiplier * songQualityMultiplier * decayFactor
      * sentimentMultiplier * reputationMultiplier;
    const viralChance = 0.01 + (sentimentT > 0.7 ? (sentimentT - 0.7) * 0.03 : 0);
    const isViral = Math.random() < viralChance;
    if (isViral) baseViews *= 5 + Math.random() * 5;
    const dailyViews = Math.max(0, Math.min(10_000_000, Math.round(baseViews * (0.7 + Math.random() * 0.6))));
    const dailyEarningsCents = Math.round(dailyViews / 5);
    const velocity = dailyViews / Math.max(1, Number(video.views_count || 1));
    const videoHypeChange = isViral ? 10 : velocity > 0.1 ? 2 : velocity > 0.01 ? 0 : -1;

    // These changes are a SINGLE Postgres transaction, not separate HTTP writes:
    // video views and earnings, character funds/fans, band earnings (via
    // band_earnings balance trigger), song hype and daily receipt. Any failure
    // rolls every change back; retrying a completed receipt returns false.
    const { data: settled, error: settleError } = await client.rpc("settle_daily_video", {
      p_day: runDate,
      p_video_id: claimedVideoId,
      p_daily_views: dailyViews,
      p_daily_earnings_cents: dailyEarningsCents,
      p_video_hype_change: videoHypeChange,
      p_is_viral: isViral,
    });
    if (settleError) throw settleError;
    if (settled !== true) throw new Error("Daily video was already settled");
    await completeJobRun({
      jobName: "simulate-video-views",
      runId,
      supabaseClient: client,
      durationMs: Date.now() - startedAt,
      processedCount: 1,
      resultSummary: { videosUpdated: 1, totalViews: dailyViews,
        totalEarnings: dailyEarningsCents / 100, videoId: claimedVideoId },
    });
    return new Response(JSON.stringify({
      success: true, videosUpdated: 1, totalViews: dailyViews,
      totalEarnings: dailyEarningsCents / 100, videoId: claimedVideoId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    if (claimedVideoId) {
      const { error: finishError } = await client.rpc("fail_daily_video", {
        p_day: runDate,
        p_video_id: claimedVideoId,
        p_error: getErrorMessage(error),
      });
      if (finishError) console.error("Failed video receipt cannot be finalized", finishError);
    }
    await failJobRun({
      jobName: "simulate-video-views",
      runId,
      supabaseClient: client,
      durationMs: Date.now() - startedAt,
      error,
    });
    console.error("Error settling daily video views:", error);
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
