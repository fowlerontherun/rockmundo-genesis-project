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
    const { genre } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");

    const prompts: Record<string, string> = {
      Rock: "Upbeat energetic rock instrumental with driving guitars, steady drums, and bass groove. Perfect for a rhythm game background. No vocals. 120 BPM.",
      Blues: "Smooth blues shuffle instrumental with clean guitar licks, walking bass, and brushed drums. Relaxed groove. No vocals. 95 BPM.",
      Punk: "Fast aggressive punk rock instrumental with distorted power chords, rapid drums, and driving bass. High energy. No vocals. 160 BPM.",
      Pop: "Uplifting pop instrumental with melodic synths, gentle acoustic guitar, and soft percussion. Feel-good vibe. No vocals. 100 BPM.",
      Metal: "Heavy metal instrumental with chugging riffs, double bass drums, and powerful energy. Intense and aggressive. No vocals. 180 BPM.",
      Funk: "Groovy funk instrumental with slap bass, wah guitar, tight drums, and brass stabs. Dance-worthy rhythm. No vocals. 105 BPM.",
    };

    const prompt = prompts[genre] || prompts["Rock"];

    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        duration_seconds: 60,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("ElevenLabs Music error:", response.status, t);
      return new Response(JSON.stringify({ error: "Music generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error("Music error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
