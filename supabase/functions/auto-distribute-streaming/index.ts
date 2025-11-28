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

    // Find releases that completed manufacturing and have streaming platforms
    const { data: releases, error: releasesError } = await supabase
      .from('releases')
      .select(`
        id,
        streaming_platforms,
        release_songs(id, song_id)
      `)
      .eq('release_status', 'released')
      .not('streaming_platforms', 'is', null)
      .filter('streaming_platforms', 'neq', '{}');

    if (releasesError) throw releasesError;

    if (!releases || releases.length === 0) {
      return new Response(JSON.stringify({ message: 'No releases to distribute' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let distributionCount = 0;

    for (const release of releases) {
      const platformIds = release.streaming_platforms || [];
      
      for (const platformId of platformIds) {
        for (const releaseSong of release.release_songs || []) {
          // Check if already distributed
          const { data: existing } = await supabase
            .from('song_releases')
            .select('id')
            .eq('song_id', releaseSong.song_id)
            .eq('platform_id', platformId)
            .single();

          if (!existing) {
            // Create song release
            const { error: insertError } = await supabase
              .from('song_releases')
              .insert({
                song_id: releaseSong.song_id,
                platform_id: platformId,
                release_id: release.id,
                released_at: new Date().toISOString(),
                is_active: true
              });

            if (!insertError) {
              distributionCount++;
              console.log(`Distributed song ${releaseSong.song_id} to platform ${platformId}`);
            }
          }
        }
      }

      // Clear streaming_platforms array after distribution
      await supabase
        .from('releases')
        .update({ streaming_platforms: [] })
        .eq('id', release.id);
    }

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