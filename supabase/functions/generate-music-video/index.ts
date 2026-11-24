import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";
import { buildMusicVideoPrompts } from "../_shared/musicVideoPrompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VideoGenerationRequest {
  videoId: string;
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

  let claimedVideoId: string | null = null;
  let registered = false;
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

    // VIP, song ownership and wallet charging were validated atomically in
    // reserve_music_video_generation. No account-level .single() or untrusted
    // caller-supplied video ID can substitute for that paid reservation.
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      console.error("REPLICATE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Video generation service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VideoGenerationRequest = await req.json();
    const { videoId } = body;
    if (typeof videoId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(videoId)) {
      return new Response(
        JSON.stringify({ error: "Invalid video ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the video exists
    const { data: video, error: videoError } = await supabaseClient
      .from("music_videos")
      .select("id, song_id, title, status, description")
      .eq("id", videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: "Video not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: attempt, error: attemptError } = await supabaseClient
      .from("music_video_generation_attempts")
      .select("id,video_id,user_id,profile_id,state")
      .eq("video_id", videoId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (attemptError || !attempt || attempt.state !== "reserved" || video.status !== "planning") {
      return new Response(JSON.stringify({ error: "No unused paid video reservation for this character" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Read the creative brief from the SAME reserved video that was charged.
    // Request-body fields are not authoritative for a paid generation.
    let savedBrief: Record<string, unknown>;
    try {
      savedBrief = JSON.parse(video.description || "{}") as Record<string, unknown>;
      if (!savedBrief || typeof savedBrief !== "object" || savedBrief.ai_generated !== true) {
        throw new Error("Not an AI video brief");
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid saved video brief" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: song, error: songError } = await supabaseClient.from("songs")
      .select("title, genre").eq("id", video.song_id).single();
    if (songError || !song) throw new Error("Reserved song not found");
    const { imagePrompt, videoPrompt, brief } = buildMusicVideoPrompts({
      songTitle: song.title,
      songGenre: typeof song.genre === "string" ? song.genre : null,
      brief: savedBrief,
    });

    // Atomic preflight claim precedes the first external provider request.
    // Two simultaneous invocations cannot both call the paid provider.
    const { error: claimError } = await supabaseClient.rpc("claim_music_video_generation", {
      p_video_id: videoId, p_attempt_id: attempt.id,
    });
    if (claimError) {
      return new Response(JSON.stringify({ error: "Video reservation has already been claimed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    claimedVideoId = videoId;

    console.log("[generate-music-video] Starting generation for video:", videoId);

    // Step 1: Generate first frame image using Lovable AI
    let firstFrameUrl: string;
    try {
      firstFrameUrl = await generateFirstFrame(imagePrompt);
    } catch (imgErr) {
      console.error("[generate-music-video] First frame generation failed:", imgErr);
      // Main catch settles the reserved charge once; never modify status
      // without moving the corresponding attempt and refund together.
      throw imgErr;
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

    // Provider identity is bound to THIS paid attempt before a callback can
    // touch any video data. A failed registration cannot accept a webhook.
    const { error: registrationError } = await supabaseClient.rpc(
      "register_music_video_prediction",
      { p_video_id: videoId, p_attempt_id: attempt.id, p_prediction_id: prediction.id },
    );
    if (registrationError) throw registrationError;
    registered = true;

    const { error: metadataError } = await supabaseClient.from("music_videos")
      .update({
        description: JSON.stringify({
          ...savedBrief,
          ...brief,
          generation_prompt: videoPrompt,
          first_frame_prompt: imagePrompt,
          replicate_prediction_id: prediction.id,
          first_frame_generated: true,
        }),
      }).eq("id", videoId);
    if (metadataError) console.warn("[generate-music-video] Nonfatal metadata update error");

    // Log activity
    await supabaseClient.from("activity_feed").insert({
      user_id: user.id,
      activity_type: "video_generation_started",
      message: `AI video generation started for "${video.title}"`,
      metadata: {
        video_id: videoId,
        visual_theme: brief.visual_theme,
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
    // Only refund a reservation that was actually claimed and has no
    // registered prediction. Once registered, the provider's verified
    // terminal webhook is solely responsible for settling the charge.
    if (claimedVideoId && !registered) {
      const { error: settlementError } = await supabaseClient.rpc(
        "settle_music_video_generation", {
          p_video_id: claimedVideoId,
          p_prediction_id: null,
          p_status: "failed",
          p_video_url: null,
          p_error: error instanceof Error ? error.message : "Generation failed to start",
        },
      );
      if (settlementError) console.error(
        "[generate-music-video] Preflight refund requires reconciliation:", settlementError.code,
      );
    }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
