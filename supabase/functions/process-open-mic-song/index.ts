import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { performanceId, songId, position } = await req.json();
    
    console.log('Processing open mic song:', { performanceId, songId, position });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get performance and song details
    const { data: performance, error: perfError } = await supabase
      .from('open_mic_performances')
      .select(`
        *,
        venue:open_mic_venues(capacity)
      `)
      .eq('id', performanceId)
      .single();

    if (perfError) throw perfError;

    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('quality_score, genre')
      .eq('id', songId)
      .single();

    if (songError) throw songError;

    // Get band chemistry if available
    let bandChemistry = 50;
    if (performance.band_id) {
      const { data: band } = await supabase
        .from('bands')
        .select('chemistry_level')
        .eq('id', performance.band_id)
        .single();
      bandChemistry = band?.chemistry_level || 50;
    }

    // Calculate performance score
    const qualityScore = song.quality_score || 50;
    const venueCapacity = performance.venue?.capacity || 75;
    
    // Base score from song quality (40% weight)
    let score = qualityScore * 0.4;
    
    // Band chemistry bonus (20% weight)
    score += bandChemistry * 0.2;
    
    // Random performance factor (40% weight) - simulates live performance variability
    const performanceFactor = 40 + Math.random() * 60; // 40-100
    score += performanceFactor * 0.4;
    
    // Small venue bonus (intimate settings help new bands)
    if (venueCapacity < 100) {
      score += 5;
    }
    
    // Clamp score to valid range for NUMERIC(4,2) - max 99.99
    score = Math.min(99.99, Math.max(0, Math.round(score * 100) / 100));

    // Determine crowd response based on score
    let crowdResponse: string;
    if (score >= 85) {
      crowdResponse = 'ecstatic';
    } else if (score >= 70) {
      crowdResponse = 'enthusiastic';
    } else if (score >= 55) {
      crowdResponse = 'engaged';
    } else if (score >= 40) {
      crowdResponse = 'mixed';
    } else {
      crowdResponse = 'disappointed';
    }

    // Generate commentary
    const commentaryOptions: Record<string, string[]> = {
      ecstatic: [
        'The crowd erupts in applause!',
        'People are on their feet!',
        'What an incredible performance!',
      ],
      enthusiastic: [
        'Great energy from the crowd!',
        'The audience is really into it!',
        'Solid performance getting great reactions!',
      ],
      engaged: [
        'The crowd is nodding along.',
        'A respectable performance.',
        'People seem to be enjoying it.',
      ],
      mixed: [
        'Some people are into it, others not so much.',
        'The reaction is a bit lukewarm.',
        'A few people check their phones.',
      ],
      disappointed: [
        'The crowd seems distracted.',
        'Not the best reception.',
        'Some people head to the bar.',
      ],
    };

    const commentary = [
      commentaryOptions[crowdResponse][Math.floor(Math.random() * 3)],
    ];

    // Save song performance
    const { error: insertError } = await supabase
      .from('open_mic_song_performances')
      .insert({
        performance_id: performanceId,
        song_id: songId,
        position,
        performance_score: score,
        crowd_response: crowdResponse,
        commentary,
      });

    if (insertError) throw insertError;

    console.log('Song processed:', { score, crowdResponse });

    return new Response(
      JSON.stringify({
        success: true,
        score,
        crowd_response: crowdResponse,
        commentary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing open mic song:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
