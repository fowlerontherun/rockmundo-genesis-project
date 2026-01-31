import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
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

    const body: VideoGenerationRequest = await req.json();
    const { videoId, songTitle, songGenre, visualTheme, artStyle, sceneDescriptions, mood, songAudioUrl } = body;

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

    // Build video generation prompt from scene descriptions
    const scenePrompt = sceneDescriptions.slice(0, 3).join(". ");
    
    const videoPrompt = `Cinematic music video for "${songTitle}"${songGenre ? ` (${songGenre} music)` : ""}. 
Visual theme: ${visualTheme}. Art style: ${artStyle}. ${mood ? `Mood: ${mood}.` : ""}
${scenePrompt}
Professional music video with dynamic camera movements, dramatic lighting, and smooth transitions. High energy performance footage.`;

    console.log("Generating video with prompt:", videoPrompt.substring(0, 200) + "...");

    // Update video status to "generating"
    await supabaseClient
      .from("music_videos")
      .update({
        status: "generating",
        description: JSON.stringify({
          visual_theme: visualTheme,
          art_style: artStyle,
          scene_descriptions: sceneDescriptions,
          mood,
          generation_started_at: new Date().toISOString(),
        }),
      })
      .eq("id", videoId);

    // Use Lovable Video Generation API
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured - falling back to storyboard-only mode");
      
      // Fall back to storyboard generation
      await supabaseClient
        .from("music_videos")
        .update({
          status: "production",
          description: JSON.stringify({
            visual_theme: visualTheme,
            art_style: artStyle,
            scene_descriptions: sceneDescriptions,
            mood,
            ai_generated: false,
            generation_prompt: videoPrompt,
            fallback_reason: "LOVABLE_API_KEY not configured",
          }),
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({
          success: true,
          videoId,
          message: "Video queued for production (storyboard mode). Real AI video generation requires API key.",
          status: "production",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate AI video using Lovable Video API
    console.log("Calling Lovable Video Generation API...");
    
    const videoResponse = await fetch("https://ai.gateway.lovable.dev/v1/video/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: videoPrompt,
        duration: 10, // 10 seconds
        resolution: "1080p",
        aspect_ratio: "16:9",
        ...(songAudioUrl && { starting_frame: songAudioUrl }), // Optional: use album art as starting frame
      }),
    });

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.error("Video API error:", videoResponse.status, errorText);
      
      // Still proceed with production status, but mark as failed generation
      await supabaseClient
        .from("music_videos")
        .update({
          status: "production",
          description: JSON.stringify({
            visual_theme: visualTheme,
            art_style: artStyle,
            scene_descriptions: sceneDescriptions,
            mood,
            ai_generated: false,
            generation_prompt: videoPrompt,
            generation_error: `API error ${videoResponse.status}: ${errorText.substring(0, 200)}`,
          }),
        })
        .eq("id", videoId);

      return new Response(
        JSON.stringify({
          success: true,
          videoId,
          message: "Video generation API unavailable. Video moved to production with storyboard.",
          status: "production",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videoData = await videoResponse.json();
    const generatedVideoUrl = videoData.video_url || videoData.url;

    console.log("Video generated successfully:", generatedVideoUrl?.substring(0, 100));

    if (generatedVideoUrl) {
      // Upload video to Supabase Storage for permanent storage
      let permanentVideoUrl = generatedVideoUrl;
      
      try {
        const videoFetchResponse = await fetch(generatedVideoUrl);
        const videoBuffer = await videoFetchResponse.arrayBuffer();
        const videoFileName = `music-videos/${videoId}_${Date.now()}.mp4`;
        
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
          console.log("Video uploaded to permanent storage:", permanentVideoUrl);
        } else {
          console.error("Upload error, using original URL:", uploadError);
        }
      } catch (uploadErr) {
        console.error("Error uploading video to storage:", uploadErr);
      }

      // Update video with generated URL
      await supabaseClient
        .from("music_videos")
        .update({
          status: "production",
          video_url: permanentVideoUrl,
          description: JSON.stringify({
            visual_theme: visualTheme,
            art_style: artStyle,
            scene_descriptions: sceneDescriptions,
            mood,
            ai_generated: true,
            generation_prompt: videoPrompt,
            generated_at: new Date().toISOString(),
          }),
        })
        .eq("id", videoId);
    } else {
      // No video URL returned - use storyboard mode
      await supabaseClient
        .from("music_videos")
        .update({
          status: "production",
          description: JSON.stringify({
            visual_theme: visualTheme,
            art_style: artStyle,
            scene_descriptions: sceneDescriptions,
            mood,
            ai_generated: false,
            generation_prompt: videoPrompt,
          }),
        })
        .eq("id", videoId);
    }

    // Log activity
    await supabaseClient.from("activity_feed").insert({
      user_id: user.id,
      activity_type: "video_generation_started",
      message: `AI video generation ${generatedVideoUrl ? "completed" : "started"} for "${video.title}"`,
      metadata: { 
        video_id: videoId, 
        visual_theme: visualTheme,
        has_video_url: !!generatedVideoUrl,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        message: generatedVideoUrl 
          ? "AI video generated successfully!" 
          : "Video generation started. Your music video is being created.",
        status: "production",
        videoUrl: generatedVideoUrl || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating video:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
