const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { displayName, artistName, originName, originDescription, traitNames, musicalStyle, careerGoal } = await req.json();

    const name = artistName || displayName || "the artist";
    const traitsText = traitNames?.length ? traitNames.join(", ") : "unique characteristics";
    const careerText = careerGoal === "solo" ? "pursuing a solo career" : careerGoal === "form_band" ? "forming their own band" : "joining an existing band";

    const prompt = `Write a 2-paragraph backstory for a musician: ${name}, origin: ${originName} (${originDescription}), traits: ${traitsText}, style: ${musicalStyle || "diverse"}, path: ${careerText}. Third person, under 150 words, emotionally resonant.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const backstory = data.content?.[0]?.text || "";

    return new Response(JSON.stringify({ backstory }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ backstory: null, error: "Failed to generate" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
