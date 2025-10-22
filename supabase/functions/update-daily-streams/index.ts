import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting daily streams and sales update...');

    // Get all active song releases on streaming platforms
    const { data: streamingReleases, error: streamingError } = await supabase
      .from('song_releases')
      .select('id, song_id, platform_id, total_streams')
      .eq('is_active', true)
      .eq('release_type', 'streaming');

    if (streamingError) {
      throw streamingError;
    }

    let streamUpdates = 0;
    let salesUpdates = 0;

    // Update streams for each release
    for (const release of streamingReleases || []) {
      // Calculate daily streams based on song quality and randomness
      const baseStreams = Math.floor(Math.random() * 100) + 10;
      const dailyStreams = baseStreams;
      const dailyRevenue = Math.floor(dailyStreams * 0.004); // $0.004 per stream average

      // Update total streams
      const { error: updateError } = await supabase
        .from('song_releases')
        .update({
          total_streams: (release.total_streams || 0) + dailyStreams,
          total_revenue: supabase.rpc('increment', { x: dailyRevenue }),
        })
        .eq('id', release.id);

      if (!updateError) {
        streamUpdates++;
      }
    }

    // Get all active physical/digital releases
    const { data: physicalReleases, error: physicalError } = await supabase
      .from('release_formats')
      .select('id, release_id, format_type')
      .in('format_type', ['digital', 'cd', 'vinyl'])
      .gte('release_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()); // Last 90 days

    if (physicalError) {
      throw physicalError;
    }

    // Generate daily sales for physical/digital releases
    for (const format of physicalReleases || []) {
      // Random chance of sales (50% chance)
      if (Math.random() > 0.5) {
        const quantity = Math.floor(Math.random() * 10) + 1;
        let pricePerUnit = 10;
        
        if (format.format_type === 'cd') pricePerUnit = 15;
        if (format.format_type === 'vinyl') pricePerUnit = 25;

        const totalAmount = quantity * pricePerUnit;

        // Insert sale record
        const { error: saleError } = await supabase
          .from('release_sales')
          .insert({
            release_format_id: format.id,
            quantity_sold: quantity,
            total_amount: totalAmount,
            sale_date: new Date().toISOString(),
          });

        if (!saleError) {
          salesUpdates++;

          // Update release total revenue
          await supabase.rpc('increment_release_revenue', {
            release_id: format.release_id,
            amount: totalAmount,
          });
        }
      }
    }

    console.log(`Updated ${streamUpdates} streaming releases and generated ${salesUpdates} sales`);

    return new Response(
      JSON.stringify({
        success: true,
        streamUpdates,
        salesUpdates,
        message: `Updated ${streamUpdates} streaming releases and ${salesUpdates} sales`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating daily streams:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
