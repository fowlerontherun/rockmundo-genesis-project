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
    const { performanceId } = await req.json();
    
    console.log('Completing major event performance:', performanceId);

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

    // Get song performances
    const { data: songPerformances, error: spError } = await supabase
      .from('major_event_song_performances')
      .select('performance_score, crowd_response')
      .eq('performance_id', performanceId);

    if (spError) throw spError;

    const event = performance.instance?.event;
    const audienceSize = event?.audience_size || 100000;
    const baseCash = event?.base_cash_reward || 100000;
    const maxCash = event?.max_cash_reward || 500000;
    const fameMultiplier = event?.fame_multiplier || 2.0;
    const fanMultiplier = event?.fan_multiplier || 2.0;

    // Calculate overall rating
    const totalScore = songPerformances.reduce((sum: number, sp: any) => sum + (sp.performance_score || 0), 0);
    const overallRating = songPerformances.length > 0 ? totalScore / songPerformances.length : 50;

    // Calculate cash earned: base + (rating/100) * (max - base)
    const cashEarned = Math.floor(baseCash + (overallRating / 100) * (maxCash - baseCash));

    // Calculate fame gained
    const baseFame = Math.floor((audienceSize / 1000) * (overallRating / 100));
    let fameGained = Math.floor(baseFame * fameMultiplier);
    
    // Performance bonus
    if (overallRating >= 85) {
      fameGained = Math.floor(fameGained * 1.5);
    } else if (overallRating >= 70) {
      fameGained = Math.floor(fameGained * 1.2);
    }
    fameGained = Math.max(50, fameGained);

    // Calculate fans gained
    const baseConversion = overallRating >= 85 ? 0.05 : 
                           overallRating >= 70 ? 0.03 :
                           overallRating >= 55 ? 0.02 : 0.01;
    const fansGained = Math.max(10, Math.floor(audienceSize * baseConversion * fanMultiplier));

    // Update performance record
    const { error: updatePerfError } = await supabase
      .from('major_event_performances')
      .update({
        status: 'completed',
        overall_rating: overallRating,
        cash_earned: cashEarned,
        fame_gained: fameGained,
        fans_gained: fansGained,
        completed_at: new Date().toISOString(),
      })
      .eq('id', performanceId);

    if (updatePerfError) throw updatePerfError;

    // Update band stats
    if (performance.band_id) {
      const { data: band } = await supabase
        .from('bands')
        .select('fame, total_fans, casual_fans, band_balance')
        .eq('id', performance.band_id)
        .single();

      if (band) {
        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + fameGained,
            total_fans: (band.total_fans || 0) + fansGained,
            casual_fans: (band.casual_fans || 0) + fansGained,
            band_balance: (band.band_balance || 0) + cashEarned,
          })
          .eq('id', performance.band_id);
      }

      // Record earnings
      await supabase
        .from('band_earnings')
        .insert({
          band_id: performance.band_id,
          amount: cashEarned,
          source: 'major_event',
          description: `Performance at ${event?.name || 'Major Event'}`,
          earned_by_user_id: performance.user_id,
        });
    }

    console.log('Major event completed:', { overallRating, cashEarned, fameGained, fansGained });

    return new Response(
      JSON.stringify({
        success: true,
        overall_rating: overallRating,
        cash_earned: cashEarned,
        fame_gained: fameGained,
        fans_gained: fansGained,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error completing major event:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
