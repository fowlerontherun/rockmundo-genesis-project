import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GENRE_OUTFIT_MAP: Record<string, string> = {
  Rock: "leather jacket, ripped jeans, vintage band tee, Chuck Taylors, wristbands",
  "Modern Rock": "leather jacket, ripped jeans, vintage band tee, Chuck Taylors, wristbands",
  "Heavy Metal": "studded leather vest, bullet belt, long wild hair, spiked gauntlets, black boots, black everything",
  "Metalcore/Djent": "studded leather vest, bullet belt, long wild hair, spiked gauntlets, black boots, black everything",
  "Punk Rock": "mohawk hairstyle, safety pins on jacket, tartan plaid pants, combat boots, DIY patches, ripped fishnet",
  "Hip Hop": "oversized gold chains, designer streetwear hoodie, snapback cap, fresh high-top sneakers, diamond earrings",
  Trap: "oversized gold chains, designer streetwear, face tattoos, grillz, baggy pants",
  Drill: "oversized chains, dark streetwear, ski mask pulled up, puffer jacket",
  "Lo-Fi Hip Hop": "oversized vintage hoodie, round glasses, headphones around neck, beanie, relaxed fit jeans",
  Pop: "bright colorful trendy outfit, statement accessories, stylish sunglasses, designer sneakers",
  "K-Pop/J-Pop": "bright pastel colors, trendy K-pop fashion, statement accessories, perfectly styled hair, platform shoes",
  Jazz: "sharp tailored suit, fedora hat, pocket square, vintage watch, polished shoes",
  Blues: "worn leather vest, old guitar strap, weathered hat, work boots, rolled-up sleeves",
  Country: "cowboy hat, western boots, denim jacket, big belt buckle, plaid shirt",
  Reggae: "rastafari red-gold-green colors, relaxed tropical shirt, dreadlocks, beaded necklaces",
  Classical: "formal concert tailcoat, bow tie, white dress shirt, cufflinks, polished dress shoes",
  Electronica: "neon rave gear, LED-accented jacket, futuristic goggles, glow accessories",
  EDM: "neon rave outfit, LED accessories, futuristic visor, glow-in-the-dark elements",
  Latin: "bold vibrant colors, ruffled shirt, tight pants, dance shoes, gold accents",
  Flamenco: "bold red and black outfit, ruffled details, traditional flair, rose accent",
  "World Music": "eclectic mix of cultural fabrics, colorful patterns, handmade jewelry",
  "R&B": "sleek satin shirt, gold jewelry, fitted pants, designer shoes",
  "Alt R&B/Neo-Soul": "sleek minimalist outfit, earth tones, statement jewelry, artistic accessories",
  "African Music": "vibrant ankara patterns, bold colors, cultural accessories, headwrap option",
  "Afrobeats/Amapiano": "vibrant ankara patterns, designer sunglasses, gold accessories, fresh sneakers",
  "Indie/Bedroom Pop": "vintage thrift store cardigan, retro round glasses, corduroy pants, canvas shoes",
  Synthwave: "retro-futuristic jacket, neon pink and cyan accents, aviator sunglasses, 80s-style hair",
  Hyperpop: "hyper-colorful glitchy outfit, platform boots, wild neon hair, cyber accessories",
  Goth: "all black Victorian outfit, dramatic dark makeup, silver jewelry, lace accents, platform boots",
};

function getOutfitPrompt(genre: string | null): string {
  if (!genre) return "casual cool musician outfit with a guitar";
  
  // Try exact match first, then partial match
  if (GENRE_OUTFIT_MAP[genre]) return GENRE_OUTFIT_MAP[genre];
  
  const lowerGenre = genre.toLowerCase();
  for (const [key, value] of Object.entries(GENRE_OUTFIT_MAP)) {
    if (key.toLowerCase().includes(lowerGenre) || lowerGenre.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return "stylish musician outfit with genre-appropriate accessories";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photoBase64, genre, userId } = await req.json();

    if (!photoBase64 || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: photoBase64 and userId" }),
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

    // Check generation count for cost
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_generation_count, cash")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Could not find player profile" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generationCount = profile.avatar_generation_count ?? 0;
    const cost = generationCount > 0 ? 500 : 0;

    if (cost > 0 && (profile.cash ?? 0) < cost) {
      return new Response(
        JSON.stringify({ error: "Not enough cash. You need $500 to regenerate your avatar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the style prompt
    const outfitDescription = getOutfitPrompt(genre);
    const stylePrompt = `Transform this person's photo into a stylized cartoon game avatar character. 

STYLE: Bold black outlines, slightly exaggerated proportions (larger head, expressive eyes), vibrant flat colors with subtle cel-shading. Similar to modern mobile game character art — NOT photorealistic, NOT anime. A distinctive illustrated look.

IMPORTANT: Keep the person's facial features recognizable (face shape, skin tone, hair color/style) but stylize them in the cartoon style described above.

OUTFIT: Dress the character in an exaggerated musician outfit: ${outfitDescription}. Make the outfit bold and eye-catching.

POSE: Three-quarter view, confident stance, looking at the viewer. Full body from head to mid-thigh.

BACKGROUND: Simple solid gradient background, no complex scenes.

OUTPUT: Single character, clean illustration, game-avatar quality, suitable as a profile picture.`;

    // Call Lovable AI (Gemini image model)
    console.log("Calling Lovable AI for avatar generation...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: stylePrompt },
              {
                type: "image_url",
                image_url: { url: photoBase64 },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate avatar. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedImageUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      console.error("No image in AI response:", JSON.stringify(aiData).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "AI did not return an image. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode the base64 image and upload to storage
    const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const fileName = `ai-avatar-${userId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to save avatar image." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const avatarUrl = publicUrl.publicUrl;

    // Update profile: set avatar_url, increment count, deduct cash
    const updates: Record<string, unknown> = {
      avatar_url: avatarUrl,
      avatar_generation_count: generationCount + 1,
    };

    if (cost > 0) {
      updates.cash = (profile.cash ?? 0) - cost;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Avatar generated but failed to update profile." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Avatar generated successfully for user ${userId}. Cost: $${cost}. Total generations: ${generationCount + 1}`);

    return new Response(
      JSON.stringify({
        avatarUrl,
        cost,
        generationCount: generationCount + 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-photo-avatar error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
