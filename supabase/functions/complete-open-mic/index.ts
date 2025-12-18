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
    
    console.log('Completing open mic performance:', performanceId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get performance details
    const { data: performance, error: perfError } = await supabase
      .from('open_mic_performances')
      .select(`
        *,
        venue:open_mic_venues(capacity, city_id)
      `)
      .eq('id', performanceId)
      .single();

    if (perfError) throw perfError;

    // Get song performances
    const { data: songPerformances, error: spError } = await supabase
      .from('open_mic_song_performances')
      .select('performance_score, crowd_response')
      .eq('performance_id', performanceId);

    if (spError) throw spError;

    // Calculate overall rating (average of song scores)
    const totalScore = songPerformances.reduce((sum, sp) => sum + (sp.performance_score || 0), 0);
    const overallRating = songPerformances.length > 0 ? totalScore / songPerformances.length : 50;

    // Calculate fame gained (scaled down from regular gigs)
    // Open mics give less fame but are easier to access
    const venueCapacity = performance.venue?.capacity || 75;
    let fameGained = Math.floor((overallRating / 100) * (venueCapacity / 10));
    
    // Bonus for exceptional performances
    if (overallRating >= 85) {
      fameGained = Math.floor(fameGained * 1.5);
    } else if (overallRating >= 70) {
      fameGained = Math.floor(fameGained * 1.2);
    }
    
    // Minimum fame for completing
    fameGained = Math.max(5, fameGained);

    // Calculate fans gained (based on performance and venue size)
    // Open mics have lower conversion but build core fanbase
    const attendanceEstimate = Math.floor(venueCapacity * (0.3 + Math.random() * 0.4)); // 30-70% capacity
    let conversionRate = 0.02; // Base 2% conversion for open mics
    
    if (overallRating >= 85) {
      conversionRate = 0.08; // 8% for amazing performances
    } else if (overallRating >= 70) {
      conversionRate = 0.05; // 5% for good performances
    } else if (overallRating >= 55) {
      conversionRate = 0.03; // 3% for decent performances
    }
    
    const fansGained = Math.max(1, Math.floor(attendanceEstimate * conversionRate));

    // Update performance record
    const { error: updatePerfError } = await supabase
      .from('open_mic_performances')
      .update({
        status: 'completed',
        overall_rating: overallRating,
        fame_gained: fameGained,
        fans_gained: fansGained,
        completed_at: new Date().toISOString(),
      })
      .eq('id', performanceId);

    if (updatePerfError) throw updatePerfError;

    // Update band stats if band exists
    if (performance.band_id) {
      // Update band fame
      const { error: bandError } = await supabase
        .from('bands')
        .update({
          fame: supabase.rpc('increment_value', { row_id: performance.band_id, amount: fameGained }),
          total_fans: supabase.rpc('increment_value', { row_id: performance.band_id, amount: fansGained }),
        })
        .eq('id', performance.band_id);

      // Use raw update instead since rpc might not exist
      const { data: band } = await supabase
        .from('bands')
        .select('fame, total_fans, casual_fans')
        .eq('id', performance.band_id)
        .single();

      if (band) {
        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + fameGained,
            total_fans: (band.total_fans || 0) + fansGained,
            casual_fans: (band.casual_fans || 0) + fansGained, // Open mic fans start as casual
          })
          .eq('id', performance.band_id);
      }

      // Update city fans if venue has city
      if (performance.venue?.city_id) {
        const { data: existingCityFans } = await supabase
          .from('band_city_fans')
          .select('*')
          .eq('band_id', performance.band_id)
          .eq('city_id', performance.venue.city_id)
          .single();

        if (existingCityFans) {
          await supabase
            .from('band_city_fans')
            .update({
              casual_fans: existingCityFans.casual_fans + fansGained,
              total_fans: existingCityFans.total_fans + fansGained,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingCityFans.id);
        } else {
          // Get city info
          const { data: city } = await supabase
            .from('cities')
            .select('name, country')
            .eq('id', performance.venue.city_id)
            .single();

          if (city) {
            await supabase
              .from('band_city_fans')
              .insert({
                band_id: performance.band_id,
                city_id: performance.venue.city_id,
                city_name: city.name,
                country: city.country,
                casual_fans: fansGained,
                total_fans: fansGained,
              });
          }
        }
      }
    }

    console.log('Open mic completed:', { overallRating, fameGained, fansGained });

    return new Response(
      JSON.stringify({
        success: true,
        overall_rating: overallRating,
        fame_gained: fameGained,
        fans_gained: fansGained,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error completing open mic:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
