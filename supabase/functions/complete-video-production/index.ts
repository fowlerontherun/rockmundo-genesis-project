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
  let completed = 0;

  try {
    runId = await startJobRun({
      jobName: "complete-video-production",
      functionName: "complete-video-production",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    // Get videos in production status
    const { data: productionVideos, error: fetchError } = await supabaseClient
      .from("music_videos")
      .select(`
        id,
        song_id,
        title,
        budget,
        production_quality,
        created_at,
        songs(id, title, quality_score, hype, band_id, user_id)
      `)
      .eq("status", "production");

    if (fetchError) throw fetchError;

    console.log(`Found ${productionVideos?.length || 0} videos in production`);

    const now = new Date();

    for (const video of productionVideos || []) {
      const createdAt = new Date(video.created_at);
      const hoursInProduction = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      // Production time based on budget:
      // $2,500 = 48 hours
      // $5,000 = 36 hours
      // $10,000 = 24 hours
      // $25,000 = 12 hours
      // $50,000+ = 6 hours
      let requiredHours = 48;
      if (video.budget >= 50000) requiredHours = 6;
      else if (video.budget >= 25000) requiredHours = 12;
      else if (video.budget >= 10000) requiredHours = 24;
      else if (video.budget >= 5000) requiredHours = 36;

      if (hoursInProduction >= requiredHours) {
        const song = video.songs as any;
        
        // Calculate initial hype based on song quality and budget
        const qualityBonus = (video.production_quality || 50) / 100;
        const songQuality = (song?.quality_score || 50) / 100;
        const initialHype = Math.round(50 * qualityBonus * songQuality + Math.random() * 30);

        // Release the video
        const { error: updateError } = await supabaseClient
          .from("music_videos")
          .update({
            status: "released",
            release_date: now.toISOString(),
            hype_score: initialHype,
          })
          .eq("id", video.id);

        if (updateError) {
          console.error("Error releasing video:", updateError);
          continue;
        }

        // Award fame to band/user
        if (song?.band_id) {
          const { data: band } = await supabaseClient
            .from("bands")
            .select("fame")
            .eq("id", song.band_id)
            .single();

          if (band) {
            await supabaseClient
              .from("bands")
              .update({ fame: (band.fame || 0) + Math.round(initialHype * 2) })
              .eq("id", song.band_id);
          }
        }

        if (song?.user_id) {
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("fame")
            .eq("user_id", song.user_id)
            .single();

          if (profile) {
            await supabaseClient
              .from("profiles")
              .update({ fame: (profile.fame || 0) + Math.round(initialHype) })
              .eq("user_id", song.user_id);
          }
        }

        // Create activity log
        if (song?.user_id) {
          await supabaseClient
            .from("activity_feed")
            .insert({
              user_id: song.user_id,
              activity_type: "video_released",
              message: `Music video "${video.title}" has been released on PooTube!`,
              metadata: { video_id: video.id, title: video.title, hype_score: initialHype },
            });
        }

        completed++;
        console.log(`Released video: ${video.title} with initial hype ${initialHype}`);
      }
    }

    console.log(`Completed ${completed} video productions`);

    await completeJobRun({
      jobName: "complete-video-production",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: completed,
      resultSummary: { completed },
    });

    return new Response(
      JSON.stringify({ success: true, completed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await failJobRun({
      jobName: "complete-video-production",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { completed },
    });

    console.error("Error completing video production:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
