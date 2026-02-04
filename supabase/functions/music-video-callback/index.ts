import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReplicateWebhookPayload {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | { video?: string; url?: string };
  error?: string;
  metrics?: {
    predict_time?: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Get videoId from query params
    const url = new URL(req.url);
    const videoId = url.searchParams.get("videoId");

    if (!videoId) {
      console.error("[music-video-callback] Missing videoId in query params");
      return new Response(
        JSON.stringify({ error: "Missing videoId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: ReplicateWebhookPayload = await req.json();
    console.log("[music-video-callback] Received webhook for video:", videoId);
    console.log("[music-video-callback] Payload status:", payload.status);

    // Get the video record
    const { data: video, error: videoError } = await supabaseClient
      .from("music_videos")
      .select("id, title, song_id, songs(user_id)")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      console.error("[music-video-callback] Video not found:", videoId);
      return new Response(
        JSON.stringify({ error: "Video not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.status === "succeeded" && payload.output) {
      console.log("[music-video-callback] Generation succeeded!");
      
      // Extract video URL from output (can be string or object)
      let replicateVideoUrl: string | undefined;
      if (typeof payload.output === "string") {
        replicateVideoUrl = payload.output;
      } else if (Array.isArray(payload.output)) {
        replicateVideoUrl = payload.output[0];
      } else if (payload.output.video) {
        replicateVideoUrl = payload.output.video;
      } else if (payload.output.url) {
        replicateVideoUrl = payload.output.url;
      }

      if (!replicateVideoUrl) {
        console.error("[music-video-callback] No video URL in output:", payload.output);
        await updateVideoError(supabaseClient, videoId, "No video URL in generation output");
        return new Response(JSON.stringify({ error: "No video URL" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      console.log("[music-video-callback] Replicate video URL:", replicateVideoUrl.substring(0, 100));

      // Download video and upload to Supabase Storage for permanent storage
      let permanentVideoUrl = replicateVideoUrl;
      
      try {
        console.log("[music-video-callback] Downloading video from Replicate...");
        const videoFetchResponse = await fetch(replicateVideoUrl);
        
        if (!videoFetchResponse.ok) {
          throw new Error(`Failed to fetch video: ${videoFetchResponse.status}`);
        }
        
        const videoBuffer = await videoFetchResponse.arrayBuffer();
        const videoFileName = `music-videos/${videoId}_${Date.now()}.mp4`;
        
        console.log("[music-video-callback] Uploading to storage:", videoFileName);
        
        const { error: uploadError } = await supabaseClient.storage
          .from("music")
          .upload(videoFileName, videoBuffer, {
            contentType: "video/mp4",
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabaseClient.storage
            .from("music")
            .getPublicUrl(videoFileName);
          
          permanentVideoUrl = publicUrlData.publicUrl;
          console.log("[music-video-callback] Uploaded to permanent storage:", permanentVideoUrl);
        } else {
          console.error("[music-video-callback] Upload error:", uploadError);
          // Continue with Replicate URL (it may expire eventually)
        }
      } catch (uploadErr) {
        console.error("[music-video-callback] Error uploading video:", uploadErr);
        // Continue with Replicate URL
      }

      // Get current description to preserve metadata
      const { data: currentVideo } = await supabaseClient
        .from("music_videos")
        .select("description")
        .eq("id", videoId)
        .single();

      let descriptionObj: Record<string, unknown> = {};
      try {
        if (currentVideo?.description) {
          descriptionObj = JSON.parse(currentVideo.description);
        }
      } catch {
        // Ignore parse errors
      }

      // Update video with generated URL
      const { error: updateError } = await supabaseClient
        .from("music_videos")
        .update({
          status: "production",
          video_url: permanentVideoUrl,
          generation_completed_at: new Date().toISOString(),
          generation_error: null,
          description: JSON.stringify({
            ...descriptionObj,
            ai_generated: true,
            generated_at: new Date().toISOString(),
            predict_time: payload.metrics?.predict_time,
          }),
        })
        .eq("id", videoId);

      if (updateError) {
        console.error("[music-video-callback] Update error:", updateError);
      }

      // Log success activity
      const userId = (video.songs as any)?.user_id;
      if (userId) {
        await supabaseClient.from("activity_feed").insert({
          user_id: userId,
          activity_type: "video_generation_completed",
          message: `AI video generation completed for "${video.title}"! 🎬`,
          metadata: { 
            video_id: videoId,
            has_video_url: true,
            predict_time: payload.metrics?.predict_time,
          },
        });
      }

      console.log("[music-video-callback] Video generation completed successfully!");
      
    } else if (payload.status === "failed") {
      console.error("[music-video-callback] Generation failed:", payload.error);
      await updateVideoError(supabaseClient, videoId, payload.error || "Generation failed");

      // Log failure activity
      const userId = (video.songs as any)?.user_id;
      if (userId) {
        await supabaseClient.from("activity_feed").insert({
          user_id: userId,
          activity_type: "video_generation_failed",
          message: `AI video generation failed for "${video.title}". Your $75,000 has been refunded.`,
          metadata: { 
            video_id: videoId,
            error: payload.error,
          },
        });

        // Refund the user
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("id, cash")
          .eq("user_id", userId)
          .single();

        if (profile) {
          await supabaseClient
            .from("profiles")
            .update({ cash: (profile.cash || 0) + 75000 })
            .eq("id", profile.id);
          
          console.log("[music-video-callback] Refunded $75,000 to user");
        }
      }
    } else {
      console.log("[music-video-callback] Ignoring status:", payload.status);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[music-video-callback] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function updateVideoError(supabaseClient: any, videoId: string, error: string) {
  // Get current description
  const { data: currentVideo } = await supabaseClient
    .from("music_videos")
    .select("description")
    .eq("id", videoId)
    .single();

  let descriptionObj: Record<string, unknown> = {};
  try {
    if (currentVideo?.description) {
      descriptionObj = JSON.parse(currentVideo.description);
    }
  } catch {
    // Ignore
  }

  await supabaseClient
    .from("music_videos")
    .update({
      status: "failed",
      generation_error: error,
      generation_completed_at: new Date().toISOString(),
      description: JSON.stringify({
        ...descriptionObj,
        ai_generated: false,
        generation_error: error,
        failed_at: new Date().toISOString(),
      }),
    })
    .eq("id", videoId);
}
