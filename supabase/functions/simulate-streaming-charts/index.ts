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

    let chartsCreated = 0;

    // Generate charts for each platform, region, and chart type
    for (const platform of platforms) {
      for (const region of regions) {
        for (const chartType of chartTypes) {
          // Create chart entries with some randomization
          const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
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

            // Calculate streams based on position and quality
            const baseStreams = (chartSize - position + 1) * 100000;
            const qualityBonus = (song.quality_score || 50) * 1000;
            const randomFactor = 0.8 + Math.random() * 0.4;
            const streams = Math.floor((baseStreams + qualityBonus) * randomFactor);

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
