import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, theme, genre, chordProgression } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const prompt = `You are a professional songwriter. Generate song lyrics based on:

Title: "${title}"
Theme: ${theme || "General"}
Genre: ${genre}
Chord Progression: ${chordProgression || "Standard"}

Generate complete song lyrics with this structure:
- Verse 1 (8 lines)
- Chorus (4-6 lines)
- Verse 2 (8 lines)
- Chorus (repeat)
- Bridge (4-6 lines)
- Final Chorus

Requirements:
- Keep lyrics authentic to the ${genre} genre
- Use vivid imagery and emotionally resonant language
- Make the chorus catchy and memorable
- Ensure verses tell a cohesive story
- Match the theme: ${theme || "universal human experience"}

Format the output clearly with section labels (Verse 1, Chorus, etc.).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are a skilled songwriter with deep knowledge of multiple genres. Always format lyrics clearly with section labels.' 
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const lyrics = data.choices?.[0]?.message?.content;

    if (!lyrics) {
      throw new Error('No lyrics generated');
    }

    return new Response(
      JSON.stringify({ lyrics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-song-lyrics:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
