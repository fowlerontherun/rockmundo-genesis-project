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
    
    console.log('Processing major event song:', { performanceId, songId, position });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get performance with event details
    const { data: performance, error: perfError } = await supabase
      .from('major_event_performances')
      .select(`
        *,
        instance:major_event_instances(
          *,
          event:major_events(*)
        )
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

    const event = performance.instance?.event;
    const audienceSize = event?.audience_size || 100000;

    // Calculate performance score
    const qualityScore = song.quality_score || 50;
    
    // Base score from song quality (35% weight)
    let score = qualityScore * 0.35;
    
    // Band chemistry bonus (20% weight)
    score += bandChemistry * 0.2;
    
    // Random performance factor (35% weight) - live performance variability
    const performanceFactor = 50 + Math.random() * 50; // 50-100 (higher floor for major events)
    score += performanceFactor * 0.35;
    
    // Major event stage presence bonus (10% weight)
    const stagePresence = 60 + Math.random() * 40;
    score += stagePresence * 0.1;
    
    // Clamp score
    score = Math.min(99.99, Math.max(0, Math.round(score * 100) / 100));

    // Determine crowd response
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

    // Generate event-themed commentary
    const eventName = event?.name || 'the event';
    const audienceLabel = audienceSize >= 1000000 ? 'millions' : 
                          audienceSize >= 100000 ? 'hundreds of thousands' : 'tens of thousands';

    const commentaryOptions: Record<string, string[]> = {
      ecstatic: [
        `The ${audienceLabel} watching are on their feet!`,
        `${eventName} will never forget this performance!`,
        'A once-in-a-lifetime moment — the crowd erupts!',
      ],
      enthusiastic: [
        `Great energy reverberating through the ${eventName} crowd!`,
        'The audience is really feeling this performance!',
        `${audienceLabel} of fans are singing along!`,
      ],
      engaged: [
        'The massive audience is nodding along.',
        'A solid performance on the big stage.',
        'The crowd seems to be enjoying it.',
      ],
      mixed: [
        'The enormous audience has mixed reactions.',
        'Some viewers are changing the channel.',
        'Not quite meeting the expectations of this stage.',
      ],
      disappointed: [
        'The crowd seems underwhelmed for such a big event.',
        'Social media is not being kind right now.',
        'A forgettable moment on a memorable stage.',
      ],
    };

    const commentary = [
      commentaryOptions[crowdResponse][Math.floor(Math.random() * 3)],
    ];

    // Save song performance
    const { error: insertError } = await supabase
      .from('major_event_song_performances')
      .insert({
        performance_id: performanceId,
        song_id: songId,
        position,
        performance_score: score,
        crowd_response: crowdResponse,
        commentary,
      });

    if (insertError) throw insertError;

    console.log('Major event song processed:', { score, crowdResponse });

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
    console.error('Error processing major event song:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
