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
    const allReleases: any[] = [];
    for (let offset = 0; ; offset += 500) {
    const { data: page, error: releasesError } = await supabase
      .from('releases')
      .select(`
        id,
        user_id,
        band_id,
        streaming_platforms,
        scheduled_release_date,
        release_songs!release_songs_release_id_fkey(id, song_id)
      `)
      .eq('release_status', 'released')
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    if (releasesError) throw releasesError;
    allReleases.push(...(page ?? []));
    if (!page || page.length < 500) break;
    }

    // Filter to only releases with non-empty streaming_platforms arrays
    const releases = (allReleases || []).filter(r => 
      r.streaming_platforms && 
      Array.isArray(r.streaming_platforms) && 
      r.streaming_platforms.length > 0
    );

    console.log(`Found ${allReleases?.length || 0} total released, ${releases.length} with streaming platforms`);

    if (releases.length === 0) {
      console.log('No releases to distribute');
      return new Response(JSON.stringify({ message: 'No releases to distribute', checked: allReleases?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${releases.length} releases to process`);
    let distributionCount = 0;

    // Pre-fetch territories for all releases being processed
    const releaseIds = releases.map(r => r.id);
    const { data: allTerritories } = await supabase
      .from('release_territories')
      .select('release_id, country, is_active')
      .in('release_id', releaseIds)
      .eq('is_active', true);

    for (const release of releases) {
      if (!release.release_songs?.length) {
        console.warn(`Release ${release.id} has no linked songs; retaining queued streaming platforms for retry`);
        continue;
      }
      const platformIds = release.streaming_platforms || [];
      const releaseTerritories = (allTerritories || []).filter(t => t.release_id === release.id);
      const territoryCountries = releaseTerritories.map(t => t.country);
      
      console.log(`Processing release ${release.id} with ${platformIds.length} platforms, ${territoryCountries.length} territories`);
      
      const failedPlatformIds: string[] = [];
      for (const platformId of platformIds) {
        // Get platform name for logging
        const { data: platform, error: platformError } = await supabase
          .from('streaming_platforms')
          .select('platform_name')
          .eq('id', platformId)
          .single();
        if (platformError || !platform) { console.error('Platform lookup failed:', platformError); failedPlatformIds.push(platformId); continue; }

        for (const releaseSong of release.release_songs || []) {
          // Check if already distributed
          const { data: existing, error: existingError } = await supabase
            .from('song_releases')
            .select('id')
            .eq('song_id', releaseSong.song_id)
            .eq('platform_id', platformId)
            .eq('release_type', 'streaming')
            .eq('is_active', true)
            .maybeSingle();
          if (existingError) { failedPlatformIds.push(platformId); console.error('Existing release lookup failed', existingError); continue; }

          if (!existing) {
            // Get user_id from release or band leader
            let userId = release.user_id;
            if (!userId && release.band_id) {
              const { data: band } = await supabase
                .from('bands')
                .select('leader_id')
                .eq('id', release.band_id)
                .single();
              userId = band?.leader_id;
            }
            
            // Create song release with territory info
            const { data: inactive } = await supabase.from('song_releases').select('id').eq('song_id',releaseSong.song_id).eq('platform_id',platformId).eq('release_type','streaming').eq('is_active',false).maybeSingle();
            const releasePayload = {
                song_id: releaseSong.song_id,
                platform_id: platformId,
                platform_name: platform?.platform_name,
                release_id: release.id,
                user_id: userId,
                band_id: release.band_id,
                release_date: release.scheduled_release_date ? `${release.scheduled_release_date}T00:00:00Z` : new Date().toISOString(),
                release_type: 'streaming',
                is_active: true,
                total_streams: 0,
                total_revenue: 0
              } as const;
            const { error: insertError } = inactive?.id
              ? await supabase.from('song_releases').update({ ...releasePayload, total_streams: undefined, total_revenue: undefined }).eq('id', inactive.id)
              : await supabase.from('song_releases').insert(releasePayload);

            if (insertError) {
              console.error(`Error inserting song_release: ${insertError.message}`);
              if (!failedPlatformIds.includes(platformId)) failedPlatformIds.push(platformId);
            } else {
              distributionCount++;
              console.log(`Distributed song ${releaseSong.song_id} to ${platform?.platform_name || platformId} (${territoryCountries.length} territories)`);
            }
          } else {
            console.log(`Song ${releaseSong.song_id} already distributed to ${platform?.platform_name || platformId}`);
          }
        }
      }

      // Clear streaming_platforms array after distribution
      const { error: updateError } = await supabase
        .from('releases')
        .update({ streaming_platforms: failedPlatformIds })
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
