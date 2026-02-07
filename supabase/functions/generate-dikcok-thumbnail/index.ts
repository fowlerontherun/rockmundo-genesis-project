import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId, title, description, bandName, bandGenre, videoType, songTitle } = await req.json();

    if (!videoId || !title) {
      return new Response(
        JSON.stringify({ error: "videoId and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build a rich prompt for thumbnail generation
    const genreStyle = getGenreVisualStyle(bandGenre || "Rock");
    const prompt = `Create a bold, eye-catching social media video thumbnail for a music platform called "DikCok" (like TikTok for musicians).

VIDEO TITLE: "${title}"
${description ? `DESCRIPTION: "${description}"` : ""}
BAND: "${bandName || "Unknown Band"}"
GENRE: ${bandGenre || "Rock"}
VIDEO TYPE: ${videoType || "Music Video"}
${songTitle ? `FEATURED SONG: "${songTitle}"` : ""}

STYLE: ${genreStyle}

REQUIREMENTS:
- Vertical aspect ratio (9:16) like a phone screen thumbnail
- Bold, large text overlay with the video title in a stylized font
- Dynamic, energetic composition with strong visual impact
- Genre-appropriate color palette and mood
- Include subtle musical elements (instruments, notes, waveforms)
- Professional quality, would make someone want to click and watch
- NO real human faces - use silhouettes, abstract figures, or instrument close-ups
- Include a small play button overlay in the center

OUTPUT: A single thumbnail image, vibrant and attention-grabbing.`;

    console.log(`Generating thumbnail for video ${videoId}: "${title}"`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: prompt },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is busy. Thumbnail will use default." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate thumbnail." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("No image in AI response");
      return new Response(
        JSON.stringify({ error: "AI did not return an image." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to storage
    const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const fileName = `thumbnail-${videoId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("dikcok-thumbnails")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to save thumbnail." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from("dikcok-thumbnails")
      .getPublicUrl(fileName);

    const thumbnailUrl = publicUrl.publicUrl;

    // Update the video record
    const { error: updateError } = await supabase
      .from("dikcok_videos")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", videoId);

    if (updateError) {
      console.error("Video update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Thumbnail generated but failed to save to video." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Thumbnail generated for video ${videoId}: ${thumbnailUrl}`);

    return new Response(
      JSON.stringify({ thumbnailUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-dikcok-thumbnail error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getGenreVisualStyle(genre: string): string {
  const styles: Record<string, string> = {
    "Rock": "Gritty, high-contrast with electric red and black tones. Distorted guitar shapes, amp textures, raw energy.",
    "Metal": "Dark, intense with crimson and steel gray. Flames, lightning, sharp angular shapes. Aggressive and powerful.",
    "Pop": "Bright, colorful with pink, blue, and gold gradients. Sparkles, clean lines, glossy and polished feel.",
    "Hip Hop": "Urban, bold with gold chains, neon purple and green. Graffiti-style lettering, street art aesthetic.",
    "R&B": "Smooth, sultry with deep purple and warm gold. Soft lighting, velvet textures, elegant and intimate.",
    "Country": "Warm amber and sunset tones. Acoustic guitar silhouettes, open road imagery, rustic and authentic.",
    "Jazz": "Sophisticated with midnight blue and brass gold. Saxophone silhouettes, smoky atmosphere, vintage elegance.",
    "Electronic": "Neon cyberpunk with electric blue and hot pink. Circuit patterns, waveforms, futuristic and digital.",
    "Punk": "Chaotic, DIY aesthetic with safety pins and torn paper textures. Bright yellow and black, raw and rebellious.",
    "Reggae": "Tropical with green, gold, and red. Palm tree silhouettes, laid-back vibes, warm and rhythmic.",
    "Blues": "Deep indigo and amber. Vintage microphone, smoky bar atmosphere, soulful and emotive.",
    "Folk": "Earthy tones with forest green and warm brown. Acoustic instruments, nature elements, organic feel.",
    "Indie": "Muted pastels with artistic imperfections. Lo-fi film grain, cassette tape aesthetics, dreamy and authentic.",
    "Latin": "Vibrant red, orange, and yellow. Rhythmic patterns, dance silhouettes, passionate and fiery.",
    "K-Pop": "Ultra-bright with candy colors and holographic effects. Clean typography, idol-style glamour, cutting-edge trendy.",
  };
  return styles[genre] || styles["Rock"];
}
