import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { genre, songTitle } = await req.json();
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not configured");

    const genrePrompts: Record<string, string> = {
      "Rock": "Upbeat energetic rock instrumental with driving electric guitars, steady drums, and bass groove. No vocals.",
      "Blues": "Smooth blues shuffle instrumental with clean guitar licks, walking bass, and brushed drums. Relaxed groove. No vocals.",
      "Punk Rock": "Fast aggressive punk rock instrumental with distorted power chords, rapid drums, and driving bass. High energy. No vocals.",
      "Pop": "Uplifting pop instrumental with melodic synths, gentle acoustic guitar, and soft percussion. Feel-good vibe. No vocals.",
      "Heavy Metal": "Heavy metal instrumental with chugging riffs, double bass drums, and powerful energy. Intense and aggressive. No vocals.",
      "R&B": "Groovy R&B instrumental with smooth bass, tight drums, and soulful keys. Dance-worthy rhythm. No vocals.",
      "Hip Hop": "Hip hop instrumental beat with punchy 808 bass, crisp hi-hats, snappy snare, and atmospheric pads. Head-nodding groove. No vocals.",
      "Jazz": "Swing jazz instrumental with walking upright bass, ride cymbal, piano comping, and smooth horn melodies. No vocals.",
      "EDM": "High energy EDM instrumental with pulsing synth bass, four-on-the-floor kick, soaring leads, and a big drop. No vocals.",
      "Country": "Country instrumental with twangy acoustic guitar, pedal steel, steady kick-snare pattern, and fiddle melody. No vocals.",
      "Reggae": "Laid-back reggae instrumental with offbeat guitar skanks, deep bass, one-drop drum pattern. No vocals.",
      "Classical": "Orchestral classical piece with strings, woodwinds, and gentle timpani. Elegant and refined. No vocals.",
      "Electronica": "Ambient electronic instrumental with evolving synth textures, glitchy beats, and deep sub-bass. No vocals.",
      "Latin": "Latin instrumental with congas, timbales, acoustic guitar, and brass. Salsa-inspired rhythm. No vocals.",
    };

    // Build style prompt
    const basePrompt = genrePrompts[genre] || genrePrompts["Rock"];
    const trackName = songTitle || `${genre || 'Rock'} Practice`;
    const stylePrompt = `${basePrompt} Perfect as background music for a rhythm game practice session called "${trackName}". 60 seconds.`;

    console.log(`[stage-practice-music] Generating ${genre} track via MiniMax Music-1.5`);
    console.log(`[stage-practice-music] Style: ${stylePrompt}`);

    // Use MiniMax Music-1.5 via Replicate (synchronous for short tracks)
    const predictionResponse = await fetch("https://api.replicate.com/v1/models/minimax/music-1.5/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: stylePrompt,
          // MiniMax Music-1.5 doesn't need lyrics for instrumentals
        },
      }),
    });

    if (!predictionResponse.ok) {
      const errText = await predictionResponse.text();
      console.error("[stage-practice-music] Replicate error:", predictionResponse.status, errText);
      return new Response(JSON.stringify({ error: "Music generation failed", detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prediction = await predictionResponse.json();
    console.log(`[stage-practice-music] Prediction status: ${prediction.status}`);

    if (prediction.status === "failed") {
      console.error("[stage-practice-music] Generation failed:", prediction.error);
      return new Response(JSON.stringify({ error: "Music generation failed", detail: prediction.error }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The output is the audio URL
    const audioUrl = prediction.output;
    if (!audioUrl) {
      return new Response(JSON.stringify({ error: "No audio output returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[stage-practice-music] Generated audio URL: ${typeof audioUrl === 'string' ? audioUrl.substring(0, 80) : JSON.stringify(audioUrl)}`);

    return new Response(JSON.stringify({ audioUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stage-practice-music] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
