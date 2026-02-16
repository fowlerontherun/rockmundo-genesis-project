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
    const { merchId, itemType, designName, bandName, qualityTier } = await req.json();

    if (!merchId || !itemType || !designName) {
      return new Response(
        JSON.stringify({ error: "merchId, itemType, and designName are required" }),
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

    const qualityStyle = getQualityStyle(qualityTier || "basic");
    const itemStyle = getItemStyle(itemType);

    const prompt = `Generate a professional product photograph of ${itemType} merchandise for a music band.

PRODUCT: "${designName}" - ${itemType}
BAND: "${bandName || "Rock Band"}"
QUALITY: ${qualityStyle}

STYLE: ${itemStyle}

REQUIREMENTS:
- Clean product photography on a neutral/white background
- Professional lighting with subtle shadows
- Show the product from a flattering angle
- Include subtle band-related design elements (music notes, instruments, or abstract art)
- The design should look like real merchandise you'd buy at a concert
- ${qualityTier === 'legendary' ? 'Premium, luxury feel with metallic or holographic accents' : ''}
- ${qualityTier === 'epic' ? 'High-end streetwear aesthetic' : ''}
- NO text overlays, NO watermarks
- Photorealistic quality

OUTPUT: A single product photo, clean and professional.`;

    console.log(`Generating merch image for ${merchId}: "${designName}" (${itemType})`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI service is busy. Please try again later." }),
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
        JSON.stringify({ error: "Failed to generate merch image." }),
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

    const fileName = `merch-${merchId}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage
      .from("merch-images")
      .upload(fileName, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to save merch image." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from("merch-images")
      .getPublicUrl(fileName);

    const imageUrl = publicUrl.publicUrl;

    // Update the merchandise record
    const { error: updateError } = await supabase
      .from("player_merchandise")
      .update({ design_preview_url: imageUrl })
      .eq("id", merchId);

    if (updateError) {
      console.error("Merch update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Image generated but failed to save to product." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Merch image generated for ${merchId}: ${imageUrl}`);

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-merch-image error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getQualityStyle(tier: string): string {
  const styles: Record<string, string> = {
    basic: "Standard quality, simple clean design. Budget-friendly merchandise.",
    good: "Good quality materials, nice print quality. Solid mid-range merchandise.",
    great: "High quality, detailed artwork, premium feel. Above average merchandise.",
    epic: "Premium streetwear quality, intricate designs, luxury materials. High-end concert merch.",
    legendary: "Ultra-premium, limited edition feel, metallic inks, holographic elements. Collector's item quality.",
  };
  return styles[tier] || styles.basic;
}

function getItemStyle(itemType: string): string {
  const type = itemType.toLowerCase();
  if (type.includes("tee") || type.includes("shirt")) return "Folded t-shirt on white background, showing the front design clearly. Soft cotton texture visible.";
  if (type.includes("hoodie") || type.includes("crewneck")) return "Hoodie laid flat or on invisible mannequin, showing front design. Thick comfortable fabric visible.";
  if (type.includes("cap") || type.includes("hat")) return "Baseball cap or beanie shown from a 3/4 angle, embroidered design visible. Clean studio shot.";
  if (type.includes("poster") || type.includes("print")) return "Art print or poster shown at slight angle with subtle shadow, concert poster aesthetic.";
  if (type.includes("vinyl")) return "Vinyl record with sleeve shown, album art visible. Classic music collector aesthetic.";
  if (type.includes("sticker")) return "Sticker pack fanned out showing multiple designs, die-cut shapes, holographic options.";
  if (type.includes("pin")) return "Enamel pin on dark background with dramatic lighting, showing metallic sheen and detail.";
  if (type.includes("bag") || type.includes("tote")) return "Canvas tote bag laid flat showing printed design, sturdy construction visible.";
  if (type.includes("mug")) return "Ceramic mug with printed design, shown from side angle on clean surface.";
  return "Product photograph on white background, clean and professional, showing the item clearly.";
}
