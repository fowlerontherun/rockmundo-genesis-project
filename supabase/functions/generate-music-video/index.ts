import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VideoGenerationRequest {
  videoId: string;
  songTitle: string;
  songGenre?: string;
  visualTheme: string;
  artStyle: string;
  sceneDescriptions: string[];
  mood?: string;
  songAudioUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user from the JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify VIP status
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, is_vip, user_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.is_vip) {
      return new Response(
        JSON.stringify({ error: "VIP subscription required for AI video generation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Video generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VideoGenerationRequest = await req.json();
    const { videoId, songTitle, songGenre, visualTheme, artStyle, sceneDescriptions, mood } = body;

    if (!videoId || !songTitle || !visualTheme || !sceneDescriptions?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: videoId, songTitle, visualTheme, sceneDescriptions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the video exists and get song info
    const { data: video, error: videoError } = await supabaseClient
      .from("music_videos")
      .select("id, song_id, title, status, songs(audio_url)")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: "Video not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build video generation prompt - focus on continuous, camera-friendly action
    const scenePrompt = sceneDescriptions.slice(0, 3).join(". ");
    
    // Video prompt optimized for AI video generation (continuous shots, no editing terms)
    const videoPrompt = `Cinematic music video scene for "${songTitle}"${songGenre ? ` (${songGenre} style)` : ""}. 
${visualTheme.replace(/_/g, " ")} visual aesthetic, ${artStyle} style${mood ? `, ${mood} atmosphere` : ""}.
${scenePrompt}
Smooth camera movement, professional lighting, high production value. Single continuous shot with dynamic motion.`;

    console.log("[generate-music-video] Starting generation for video:", videoId);
    console.log("[generate-music-video] Prompt:", videoPrompt.substring(0, 300) + "...");

    // Update video status to "generating"
    await supabaseClient
      .from("music_videos")
      .update({
        status: "generating",
        generation_started_at: new Date().toISOString(),
        generation_error: null,
        description: JSON.stringify({
          visual_theme: visualTheme,
          art_style: artStyle,
          scene_descriptions: sceneDescriptions,
          mood,
          generation_started_at: new Date().toISOString(),
          generation_prompt: videoPrompt,
        }),
      })
      .eq("id", videoId);

    // Initialize Replicate
    const replicate = new Replicate({ auth: REPLICATE_API_KEY });

    // Build webhook URL for async callback
    const webhookUrl = `${supabaseUrl}/functions/v1/music-video-callback?videoId=${videoId}`;
    
    console.log("[generate-music-video] Calling Replicate with webhook:", webhookUrl);

    // Use Replicate's async webhook pattern for video generation
    // MiniMax video-01-live model for fast video generation
    const prediction = await replicate.predictions.create({
      model: "minimax/video-01-live",
      input: {
        prompt: videoPrompt,
      },
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    });

    console.log("[generate-music-video] Replicate prediction created:", prediction.id);

    // Store prediction ID for tracking
    await supabaseClient
      .from("music_videos")
      .update({
        description: JSON.stringify({
          visual_theme: visualTheme,
          art_style: artStyle,
          scene_descriptions: sceneDescriptions,
          mood,
          generation_started_at: new Date().toISOString(),
          generation_prompt: videoPrompt,
          replicate_prediction_id: prediction.id,
        }),
      })
      .eq("id", videoId);

    // Log activity
    await supabaseClient.from("activity_feed").insert({
      user_id: user.id,
      activity_type: "video_generation_started",
      message: `AI video generation started for "${video.title}"`,
      metadata: { 
        video_id: videoId, 
        visual_theme: visualTheme,
        prediction_id: prediction.id,
        estimated_time: "2-5 minutes",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        predictionId: prediction.id,
        message: "AI video generation started! This typically takes 2-5 minutes. The video will appear automatically when ready.",
        status: "generating",
        estimatedTime: "2-5 minutes",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-music-video] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
