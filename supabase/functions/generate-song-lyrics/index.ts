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

    // Generate dynamic variation elements for unique lyrics
    const perspectives = ['first person', 'second person', 'third person narrative', 'conversational'];
    const tones = ['introspective', 'energetic', 'melancholic', 'rebellious', 'romantic', 'nostalgic', 'hopeful', 'dark', 'playful'];
    const narrativeStyles = ['story-driven', 'emotion-focused', 'metaphorical', 'direct', 'abstract', 'cinematic'];
    const lyricalTechniques = ['heavy imagery', 'simple and direct', 'metaphor-rich', 'dialogue-based', 'stream of consciousness'];
    const tempos = ['fast-paced', 'mid-tempo', 'slow-burning', 'dynamic shifts'];
    
    const randomPerspective = perspectives[Math.floor(Math.random() * perspectives.length)];
    const randomTone = tones[Math.floor(Math.random() * tones.length)];
    const randomNarrativeStyle = narrativeStyles[Math.floor(Math.random() * narrativeStyles.length)];
    const randomTechnique = lyricalTechniques[Math.floor(Math.random() * lyricalTechniques.length)];
    const randomTempo = tempos[Math.floor(Math.random() * tempos.length)];

    // Genre-specific style markers
    const genreStyles: Record<string, string> = {
      'Rock': 'powerful vocals, guitar-driven energy, anthemic choruses',
      'Pop': 'catchy hooks, melodic verses, radio-friendly chorus',
      'Hip-Hop': 'rhythmic flow, wordplay, storytelling with swagger',
      'Country': 'narrative storytelling, down-to-earth imagery, relatable struggles',
      'Jazz': 'sophisticated wordplay, smooth phrasing, improvisational feel',
      'Blues': 'emotional depth, call and response, life struggles',
      'Electronic': 'repetitive hooks, atmospheric phrases, modern themes',
      'Folk': 'acoustic storytelling, traditional themes, poetic simplicity',
      'Metal': 'intense imagery, aggressive themes, complex structures',
      'R&B': 'smooth vocals, emotional vulnerability, intimate themes',
      'Indie': 'unconventional structures, artistic expression, personal narratives',
      'Reggae': 'laid-back flow, social commentary, positive vibes',
      'Punk': 'raw energy, rebellious themes, direct messages',
      'Classical': 'poetic language, classical themes, operatic style',
      'Soul': 'emotional authenticity, gospel influence, powerful delivery'
    };
    
    const genreStyle = genreStyles[genre] || 'authentic expression with genre-appropriate phrasing';

    const prompt = `You are a professional songwriter creating UNIQUE, ORIGINAL lyrics. Each song must be DISTINCTLY DIFFERENT.

SONG DETAILS:
Title: "${title}"
Theme: ${theme || "Universal human experience"}
Genre: ${genre}
Chord Progression: ${chordProgression || "Standard"}

CREATIVE DIRECTION (apply these to make lyrics UNIQUE):
- Perspective: ${randomPerspective}
- Emotional Tone: ${randomTone}
- Narrative Style: ${randomNarrativeStyle}
- Lyrical Technique: ${randomTechnique}
- Tempo/Pacing: ${randomTempo}
- Genre Style: ${genreStyle}

STRUCTURE REQUIREMENTS:
- Verse 1 (8 lines) - Introduce the scenario/feeling
- Pre-Chorus (2-3 lines, optional but encouraged)
- Chorus (4-6 lines) - Main hook, repeatable
- Verse 2 (8 lines) - Develop the story/deepen emotion
- Chorus (repeat)
- Bridge (4-6 lines) - Shift perspective or intensity
- Final Chorus (with variation or ad-libs)

CRITICAL REQUIREMENTS FOR UNIQUENESS:
1. Use SPECIFIC, CONCRETE DETAILS (not generic phrases)
2. Create a UNIQUE metaphor or central image for this song
3. Include sensory details (sights, sounds, textures)
4. Use unexpected word combinations and fresh imagery
5. Avoid clichés like "heart on my sleeve", "time will tell", "love is blind"
6. Make the chorus MEMORABLE with a distinctive hook
7. Vary line lengths and rhythmic patterns
8. Include 1-2 surprising word choices or turns of phrase
9. Write from the specified ${randomPerspective} perspective
10. Match the ${randomTone} emotional tone throughout

GENRE-SPECIFIC AUTHENTICITY:
Apply ${genre} conventions: ${genreStyle}

Format with clear section labels: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Final Chorus]`;

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
            content: `You are a professional songwriter who creates ORIGINAL, DISTINCTIVE lyrics for every song. 
Never repeat the same phrases or ideas across different songs. Each set of lyrics must be completely unique with fresh imagery, unexpected metaphors, and genre-appropriate authenticity. 
Use specific details over generic statements. Avoid all lyrical clichés.
Format all lyrics with clear section labels in brackets: [Verse 1], [Chorus], etc.` 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9, // Higher temperature for more creativity and variation
        top_p: 0.95 // Allow diverse token sampling for uniqueness
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
