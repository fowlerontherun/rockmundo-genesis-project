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

/** Generate a first-frame image using Lovable AI (Gemini image model) */
async function generateFirstFrame(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  console.log("[generate-music-video] Generating first frame image...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [
        {
          role: "user",
          content: `Generate a cinematic wide-angle 16:9 still image for a music video. ${prompt}. Ultra high resolution, cinematic lighting, professional cinematography. No text or watermarks.`,
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[generate-music-video] Image generation failed:", response.status, errorText);
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!imageUrl) {
    throw new Error("No image returned from AI gateway");
  }

  console.log("[generate-music-video] First frame image generated successfully");
  return imageUrl;
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

    // Verify the video exists
    const { data: video, error: videoError } = await supabaseClient
      .from("music_videos")
      .select("id, song_id, title, status")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: "Video not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompts
    const scenePrompt = sceneDescriptions.slice(0, 3).join(". ");
    const videoPrompt = `Cinematic music video scene for "${songTitle}"${songGenre ? ` (${songGenre} style)` : ""}. 
${visualTheme.replace(/_/g, " ")} visual aesthetic, ${artStyle} style${mood ? `, ${mood} atmosphere` : ""}.
${scenePrompt}
Smooth camera movement, professional lighting, high production value. Single continuous shot with dynamic motion.`;

    const imagePrompt = `${visualTheme.replace(/_/g, " ")} scene for a ${songGenre || "music"} video called "${songTitle}". ${artStyle} style${mood ? `, ${mood} mood` : ""}. ${sceneDescriptions[0] || ""}`;

    console.log("[generate-music-video] Starting generation for video:", videoId);

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

    // Step 1: Generate first frame image using Lovable AI
    let firstFrameUrl: string;
    try {
      firstFrameUrl = await generateFirstFrame(imagePrompt);
    } catch (imgErr) {
      console.error("[generate-music-video] First frame generation failed:", imgErr);
      await supabaseClient
        .from("music_videos")
        .update({
          status: "failed",
          generation_error: `First frame image generation failed: ${imgErr instanceof Error ? imgErr.message : "Unknown error"}`,
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({ error: "Failed to generate first frame image for video" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Call Replicate with the first frame image
    const replicate = new Replicate({ auth: REPLICATE_API_KEY });
    const webhookUrl = `${supabaseUrl}/functions/v1/music-video-callback?videoId=${videoId}`;

    console.log("[generate-music-video] Calling Replicate with first frame and webhook:", webhookUrl);

    const prediction = await replicate.predictions.create({
      model: "minimax/video-01-live",
      input: {
        prompt: videoPrompt,
        first_frame_image: firstFrameUrl,
      },
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    });

    console.log("[generate-music-video] Replicate prediction created:", prediction.id);

    // Store prediction ID
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
          first_frame_generated: true,
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
