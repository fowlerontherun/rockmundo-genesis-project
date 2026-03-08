import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date().toISOString().split("T")[0];
    const regions = ["GLOBAL", "US", "UK", "DE", "FR", "JP", "BR", "AU", "CA", "MX"];
    const chartTypes = ["top_40_today", "top_40_week", "viral_50"];

    // Get all streaming platforms
    const { data: platforms } = await supabase
      .from("streaming_platforms")
      .select("id, platform_name");

    if (!platforms?.length) {
      return new Response(JSON.stringify({ message: "No platforms found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get released songs with quality scores
    const { data: songs } = await supabase
      .from("songs")
      .select("id, title, quality_score, band_id, user_id, release_status, created_at")
      .eq("release_status", "released")
      .order("quality_score", { ascending: false })
      .limit(200);

    if (!songs?.length) {
      return new Response(JSON.stringify({ message: "No released songs found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get band names for songs
    const bandIds = [...new Set(songs.filter(s => s.band_id).map(s => s.band_id))];
    const { data: bands } = await supabase
      .from("bands")
      .select("id, name")
      .in("id", bandIds);

    const bandMap = new Map(bands?.map(b => [b.id, b.name]) || []);

    // Pre-fetch release territories for all songs to determine regional eligibility
    const songIds = songs.map(s => s.id);
    const { data: releaseSongs } = await supabase
      .from("release_songs")
      .select("song_id, release_id")
      .in("song_id", songIds);
    
    const releaseIdsForSongs = [...new Set((releaseSongs || []).map(rs => rs.release_id).filter(Boolean))];
    let songTerritoryMap = new Map<string, string[]>(); // song_id -> country[]
    
    if (releaseIdsForSongs.length > 0) {
      const { data: territories } = await supabase
        .from("release_territories")
        .select("release_id, country")
        .in("release_id", releaseIdsForSongs)
        .eq("is_active", true);
      
      // Map song_id to their territory countries
      for (const rs of releaseSongs || []) {
        const songTerritories = (territories || [])
          .filter(t => t.release_id === rs.release_id)
          .map(t => t.country);
        const existing = songTerritoryMap.get(rs.song_id) || [];
        songTerritoryMap.set(rs.song_id, [...new Set([...existing, ...songTerritories])]);
      }
    }

    // Map regions to countries for chart filtering
    const regionCountryMap: Record<string, string[]> = {
      "US": ["United States"],
      "UK": ["United Kingdom"],
      "DE": ["Germany"],
      "FR": ["France"],
      "JP": ["Japan"],
      "BR": ["Brazil"],
      "AU": ["Australia"],
      "CA": ["Canada"],
      "MX": ["Mexico"],
    };

    let chartsCreated = 0;

    // Generate charts for each platform, region, and chart type
    for (const platform of platforms) {
      for (const region of regions) {
        for (const chartType of chartTypes) {
          // Filter songs by territory for regional charts
          let eligibleSongs = songs;
          if (region !== "GLOBAL") {
            const regionCountries = regionCountryMap[region] || [];
            eligibleSongs = songs.filter(song => {
              const territories = songTerritoryMap.get(song.id) || [];
              // If no territories defined (legacy), include in all charts
              if (territories.length === 0) return true;
              // Check if any territory country matches the chart region
              return regionCountries.some(rc => territories.includes(rc)) || 
                // Spillover: 10% chance for songs in adjacent territories
                Math.random() < 0.1;
            });
          }

          if (eligibleSongs.length === 0) continue;

          const shuffledSongs = [...eligibleSongs].sort(() => Math.random() - 0.5);
          const chartSize = chartType === "viral_50" ? 50 : 40;
          const chartSongs = shuffledSongs.slice(0, chartSize);

          const entries = chartSongs.map((song, index) => {
            const position = index + 1;
            const previousPosition = Math.random() > 0.3 
              ? position + Math.floor(Math.random() * 10) - 5 
              : null;
            
            let movement: string;
            if (previousPosition === null) {
              movement = "new";
            } else if (previousPosition > position) {
              movement = "up";
            } else if (previousPosition < position) {
              movement = "down";
            } else {
              movement = "same";
            }

            // Territory bonus: songs in more territories rank higher
            const territoryCount = (songTerritoryMap.get(song.id) || []).length;
            const territoryBonus = Math.sqrt(Math.max(1, territoryCount)) * 0.5;

            const baseStreams = (chartSize - position + 1) * 100000;
            const qualityBonus = (song.quality_score || 50) * 1000;
            const randomFactor = 0.8 + Math.random() * 0.4;
            const streams = Math.floor((baseStreams + qualityBonus) * randomFactor * (1 + territoryBonus));

            return {
              position,
              song_id: song.id,
              song_title: song.title,
              artist_name: bandMap.get(song.band_id) || "Unknown Artist",
              streams,
              previous_position: previousPosition,
              movement,
              peak_position: Math.min(position, previousPosition || position),
              weeks_on_chart: Math.floor(Math.random() * 20) + 1,
            };
          });

          // Upsert chart data
          const { error } = await supabase
            .from("streaming_charts")
            .upsert({
              platform_id: platform.id,
              chart_type: chartType,
              region,
              chart_date: today,
              entries,
            }, {
              onConflict: "platform_id,chart_type,region,chart_date",
            });

          if (!error) {
            chartsCreated++;
          }
        }
      }
    }

    // === CHART HIT SENTIMENT BOOST (v1.0.945) ===
    // Songs in the top 10 of GLOBAL charts trigger a chart_hit sentiment event
    try {
      // Collect band_ids that hit top 10 on any GLOBAL chart
      const top10BandIds = new Set<string>();
      // We already have songs array with band_id — check which entered top 10
      // The chart entries are generated per platform/region, track GLOBAL top 10s
      for (const song of songs) {
        if (song.band_id) {
          // Simple heuristic: high quality songs likely charted top 10
          // In practice the entries are random, so we flag bands with quality_score >= 75
          if ((song.quality_score || 0) >= 75) {
            top10BandIds.add(song.band_id);
          }
        }
      }

      for (const bId of top10BandIds) {
        const { data: band } = await supabase
          .from('bands')
          .select('fan_sentiment_score, media_intensity, media_fatigue')
          .eq('id', bId)
          .single();

        if (band) {
          const curSentiment = (band as any).fan_sentiment_score ?? 0;
          const curIntensity = (band as any).media_intensity ?? 0;
          const newSentiment = Math.min(100, curSentiment + 12);

          // === MORALE + REPUTATION BOOST: Charting is a huge deal (v1.0.968) ===
          const curMorale = (band as any).morale ?? 50;
          const curRep = (band as any).reputation_score ?? 0;

          await supabase.from('bands').update({
            fan_sentiment_score: newSentiment,
            media_intensity: Math.min(100, curIntensity + 15),
            morale: Math.min(100, curMorale + 8),
            reputation_score: Math.min(100, curRep + 5),
          } as any).eq('id', bId);

          await supabase.from('band_sentiment_events').insert({
            band_id: bId,
            event_type: 'chart_hit',
            sentiment_change: 12,
            media_intensity_change: 15,
            sentiment_after: newSentiment,
            source: 'simulate-streaming-charts',
            description: 'Chart performance boosted fan excitement and media coverage',
          });
        }
      }

      if (top10BandIds.size > 0) {
        console.log(`[simulate-streaming-charts] Chart hit sentiment boost for ${top10BandIds.size} bands`);
      }
    } catch (sentErr) {
      console.error('[simulate-streaming-charts] Error applying chart sentiment:', sentErr);
    }

    // Log the run
    await supabase.from("cron_job_runs").insert({
      job_name: "simulate-streaming-charts",
      status: "completed",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      processed_count: chartsCreated,
      result_summary: { 
        charts_created: chartsCreated,
        platforms: platforms.length,
        regions: regions.length,
        chart_types: chartTypes.length,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        charts_created: chartsCreated,
        message: `Created ${chartsCreated} chart entries`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error simulating streaming charts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
