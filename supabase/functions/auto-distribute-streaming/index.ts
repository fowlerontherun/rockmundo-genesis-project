import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting auto-distribute-streaming function...');

    // Find releases that completed manufacturing and have streaming platforms
    const { data: releases, error: releasesError } = await supabase
      .from('releases')
      .select(`
        id,
        user_id,
        band_id,
        streaming_platforms,
        release_songs!release_songs_release_id_fkey(id, song_id)
      `)
      .eq('release_status', 'released')
      .not('streaming_platforms', 'is', null)
      .filter('streaming_platforms', 'neq', '{}');

    if (releasesError) {
      console.error('Error fetching releases:', releasesError);
      throw releasesError;
    }

    if (!releases || releases.length === 0) {
      console.log('No releases to distribute');
      return new Response(JSON.stringify({ message: 'No releases to distribute' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${releases.length} releases to process`);
    let distributionCount = 0;

    for (const release of releases) {
      const platformIds = release.streaming_platforms || [];
      console.log(`Processing release ${release.id} with ${platformIds.length} platforms`);
      
      for (const platformId of platformIds) {
        // Get platform name for logging
        const { data: platform } = await supabase
          .from('streaming_platforms')
          .select('platform_name')
          .eq('id', platformId)
          .single();

        for (const releaseSong of release.release_songs || []) {
          // Check if already distributed
          const { data: existing } = await supabase
            .from('song_releases')
            .select('id')
            .eq('song_id', releaseSong.song_id)
            .eq('platform_id', platformId)
            .single();

          if (!existing) {
            // Create song release with all required fields
            const { error: insertError } = await supabase
              .from('song_releases')
              .insert({
                song_id: releaseSong.song_id,
                platform_id: platformId,
                platform_name: platform?.platform_name,
                release_id: release.id,
                user_id: release.user_id,
                band_id: release.band_id,
                release_date: new Date().toISOString(),
                release_type: 'streaming',
                is_active: true,
                total_streams: 0,
                total_revenue: 0
              });

            if (insertError) {
              console.error(`Error inserting song_release: ${insertError.message}`);
            } else {
              distributionCount++;
              console.log(`Distributed song ${releaseSong.song_id} to ${platform?.platform_name || platformId}`);
            }
          } else {
            console.log(`Song ${releaseSong.song_id} already distributed to ${platform?.platform_name || platformId}`);
          }
        }
      }

      // Clear streaming_platforms array after distribution
      const { error: updateError } = await supabase
        .from('releases')
        .update({ streaming_platforms: [] })
        .eq('id', release.id);

      if (updateError) {
        console.error(`Error clearing streaming_platforms for release ${release.id}:`, updateError.message);
      }
    }

    console.log(`Distribution complete. Distributed ${distributionCount} songs.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Distributed ${distributionCount} songs to streaming platforms`,
        distributionCount 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});