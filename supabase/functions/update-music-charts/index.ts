import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let chartsUpdated = 0;
  const chartEntries: any[] = [];

  try {
    runId = await startJobRun({
      jobName: "update-music-charts",
      functionName: "update-music-charts",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const chartDate = new Date().toISOString().split("T")[0];

    const RELEASE_SCOPES = ["single", "ep", "album"] as const;
    type ReleaseScope = (typeof RELEASE_SCOPES)[number];

    const toReleaseScope = (value: unknown): ReleaseScope => {
      return RELEASE_SCOPES.includes(value as ReleaseScope)
        ? (value as ReleaseScope)
        : "single";
    };

    const scopedType = (base: string, scope: ReleaseScope) => `${base}_${scope}`;

    console.log(`Starting chart generation for ${chartDate}`);

    // === STREAMING CHARTS (ALL released songs) ===
    const { data: streamingData, error: streamingError } = await supabaseClient
      .from("song_releases")
      .select(`
        song_id,
        total_streams,
        release:releases(
          release_type
        ),
        songs!inner(
          id,
          title,
          genre,
          user_id,
          band_id,
          status
        )
      `)
      .eq("is_active", true)
      .eq("songs.status", "released")
      .gte("total_streams", 0)
      .order("total_streams", { ascending: false })
      .limit(500);

    if (streamingError) {
      console.error("Error fetching streaming data:", streamingError);
    }

    console.log(`Fetched ${streamingData?.length || 0} streaming entries`);

    // Aggregate by song (multiple platforms) and also by release scope (single/ep/album)
    const streamingAggregated = new Map<string, any>();
    const streamingAggregatedByScope = new Map<string, any>();

    for (const entry of streamingData || []) {
      const existing = streamingAggregated.get(entry.song_id);
      if (existing) {
        existing.total_streams += entry.total_streams;
      } else {
        streamingAggregated.set(entry.song_id, {
          song_id: entry.song_id,
          total_streams: entry.total_streams,
          song: entry.songs,
        });
      }

      const scope = toReleaseScope((entry as any)?.release?.release_type);
      const scopedKey = `${entry.song_id}:${scope}`;
      const existingScoped = streamingAggregatedByScope.get(scopedKey);
      if (existingScoped) {
        existingScoped.total_streams += entry.total_streams;
      } else {
        streamingAggregatedByScope.set(scopedKey, {
          song_id: entry.song_id,
          scope,
          total_streams: entry.total_streams,
          song: entry.songs,
        });
      }
    }

    const streamingEntries = Array.from(streamingAggregated.values())
      .sort((a, b) => b.total_streams - a.total_streams)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.song_id,
        chart_type: "streaming",
        rank: index + 1,
        plays_count: entry.total_streams,
        chart_date: chartDate,
        genre: entry.song?.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...streamingEntries);

    const streamingScopedEntries = Array.from(streamingAggregatedByScope.values())
      .sort((a, b) => b.total_streams - a.total_streams)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.song_id,
        chart_type: scopedType("streaming", entry.scope),
        rank: index + 1,
        plays_count: entry.total_streams,
        chart_date: chartDate,
        genre: entry.song?.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...streamingScopedEntries);

    console.log(`Generated ${streamingEntries.length} streaming entries, ${streamingScopedEntries.length} scoped entries`);

    // === SALES CHARTS (ALL released songs) - Fixed with explicit FK hint ===
    const salesTypes = [
      { type: "digital_sales", format: "digital" },
      { type: "cd_sales", format: "cd" },
      { type: "vinyl_sales", format: "vinyl" },
      { type: "cassette_sales", format: "cassette" },
    ];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const salesType of salesTypes) {
      // Use explicit FK hint to disambiguate the release_songs relationship
      const { data: salesData, error: salesError } = await supabaseClient
        .from("release_sales")
        .select(`
          release_format_id,
          quantity_sold,
          release_formats!inner(
            format_type,
            release:releases!inner(
              id,
              release_type,
              release_songs:release_songs!release_songs_release_id_fkey(
                song:songs!inner(
                  id,
                  title,
                  genre,
                  user_id,
                  band_id,
                  status
                )
              )
            )
          )
        `)
        .eq("release_formats.format_type", salesType.format)
        .gte("sale_date", sevenDaysAgo.toISOString())
        .order("quantity_sold", { ascending: false });

      if (salesError) {
        console.error(`Error fetching ${salesType.type} data:`, salesError);
        continue;
      }

      console.log(`Fetched ${salesData?.length || 0} ${salesType.type} entries`);

      // Aggregate by song + also by scope
      const songSales = new Map<string, number>();
      const songInfo = new Map<string, any>();
      const songSalesByScope = new Map<string, number>();
      const songInfoByScope = new Map<string, any>();

      for (const sale of salesData || []) {
        const release = sale.release_formats?.release;
        if (!release || !release.release_songs) continue;

        const scope = toReleaseScope((release as any)?.release_type);

        for (const releaseSong of release.release_songs) {
          const song = releaseSong.song;
          if (!song) continue;

          const currentSales = songSales.get(song.id) || 0;
          songSales.set(song.id, currentSales + sale.quantity_sold);

          if (!songInfo.has(song.id)) {
            songInfo.set(song.id, {
              title: song.title,
              genre: song.genre,
              user_id: song.user_id,
              band_id: song.band_id,
            });
          }

          const scopedKey = `${song.id}:${scope}`;
          const currentScopedSales = songSalesByScope.get(scopedKey) || 0;
          songSalesByScope.set(scopedKey, currentScopedSales + sale.quantity_sold);

          if (!songInfoByScope.has(scopedKey)) {
            songInfoByScope.set(scopedKey, {
              title: song.title,
              genre: song.genre,
              scope,
            });
          }
        }
      }

      const salesEntries = Array.from(songSales.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([songId, sales], index) => {
          const info = songInfo.get(songId);
          return {
            song_id: songId,
            chart_type: salesType.type,
            rank: index + 1,
            plays_count: sales,
            chart_date: chartDate,
            genre: info?.genre,
            country: "all",
            sale_type: salesType.format,
            entry_type: "song",
          };
        });

      chartEntries.push(...salesEntries);

      const scopedSalesEntries = Array.from(songSalesByScope.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([scopedKey, sales], index) => {
          const [songId] = scopedKey.split(":");
          const info = songInfoByScope.get(scopedKey);
          return {
            song_id: songId,
            chart_type: scopedType(salesType.type, info?.scope),
            rank: index + 1,
            plays_count: sales,
            chart_date: chartDate,
            genre: info?.genre,
            country: "all",
            sale_type: salesType.format,
            entry_type: "song",
          };
        });

      chartEntries.push(...scopedSalesEntries);
      console.log(`Generated ${salesEntries.length} ${salesType.type} entries, ${scopedSalesEntries.length} scoped`);
    }

    // === OVERALL RECORD SALES (physical combined) - Fixed with explicit FK hint ===
    const { data: recordSales, error: recordError } = await supabaseClient
      .from("release_sales")
      .select(`
        release_format_id,
        quantity_sold,
        release_formats!inner(
          format_type,
          release:releases!inner(
            id,
            release_type,
            release_songs:release_songs!release_songs_release_id_fkey(
              song:songs!inner(
                id,
                title,
                genre,
                user_id,
                band_id,
                status
              )
            )
          )
        )
      `)
      .in("release_formats.format_type", ["cd", "vinyl", "cassette"])
      .gte("sale_date", sevenDaysAgo.toISOString());

    if (recordError) {
      console.error("Error fetching record sales:", recordError);
    }

    console.log(`Fetched ${recordSales?.length || 0} record sales entries`);

    const recordSongSales = new Map<string, number>();
    const recordSongInfo = new Map<string, any>();
    const recordSongSalesByScope = new Map<string, number>();
    const recordSongInfoByScope = new Map<string, any>();

    for (const sale of recordSales || []) {
      const release = sale.release_formats?.release;
      if (!release || !release.release_songs) continue;

      const scope = toReleaseScope((release as any)?.release_type);

      for (const releaseSong of release.release_songs) {
        const song = releaseSong.song;
        if (!song) continue;

        const currentSales = recordSongSales.get(song.id) || 0;
        recordSongSales.set(song.id, currentSales + sale.quantity_sold);

        if (!recordSongInfo.has(song.id)) {
          recordSongInfo.set(song.id, {
            title: song.title,
            genre: song.genre,
            user_id: song.user_id,
            band_id: song.band_id,
          });
        }

        const scopedKey = `${song.id}:${scope}`;
        const currentScopedSales = recordSongSalesByScope.get(scopedKey) || 0;
        recordSongSalesByScope.set(scopedKey, currentScopedSales + sale.quantity_sold);

        if (!recordSongInfoByScope.has(scopedKey)) {
          recordSongInfoByScope.set(scopedKey, {
            title: song.title,
            genre: song.genre,
            scope,
          });
        }
      }
    }

    const recordEntries = Array.from(recordSongSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([songId, sales], index) => {
        const info = recordSongInfo.get(songId);
        return {
          song_id: songId,
          chart_type: "record_sales",
          rank: index + 1,
          plays_count: sales,
          chart_date: chartDate,
          genre: info?.genre,
          country: "all",
          sale_type: "physical",
          entry_type: "song",
        };
      });

    chartEntries.push(...recordEntries);

    const recordScopedEntries = Array.from(recordSongSalesByScope.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([scopedKey, sales], index) => {
        const [songId] = scopedKey.split(":");
        const info = recordSongInfoByScope.get(scopedKey);
        return {
          song_id: songId,
          chart_type: scopedType("record_sales", info?.scope),
          rank: index + 1,
          plays_count: sales,
          chart_date: chartDate,
          genre: info?.genre,
          country: "all",
          sale_type: "physical",
          entry_type: "song",
        };
      });

    chartEntries.push(...recordScopedEntries);
    console.log(`Generated ${recordEntries.length} record sales entries, ${recordScopedEntries.length} scoped`);

    // === ALBUM PHYSICAL SALES CHARTS ===
    // Aggregate physical sales at release/album level
    const { data: albumPhysicalSales, error: albumPhysicalError } = await supabaseClient
      .from("release_sales")
      .select(`
        release_format_id,
        quantity_sold,
        release_formats!inner(
          format_type,
          release_id,
          release:releases!inner(
            id,
            title,
            release_type,
            band_id,
            bands(name, artist_name)
          )
        )
      `)
      .in("release_formats.format_type", ["cd", "vinyl", "cassette"])
      .gte("sale_date", sevenDaysAgo.toISOString());

    if (albumPhysicalError) {
      console.error("Error fetching album physical sales:", albumPhysicalError);
    }

    console.log(`Fetched ${albumPhysicalSales?.length || 0} album physical sales entries`);

    // Aggregate by release_id for album charts
    const albumPhysicalAggregated = new Map<string, {
      release_id: string;
      release_title: string;
      band_name: string;
      total_sales: number;
      release_type: string;
    }>();

    for (const sale of albumPhysicalSales || []) {
      const release = sale.release_formats?.release;
      if (!release) continue;

      const releaseId = release.id;
      const existing = albumPhysicalAggregated.get(releaseId);
      if (existing) {
        existing.total_sales += sale.quantity_sold;
      } else {
        const bandName = release.bands?.artist_name || release.bands?.name || "Unknown Artist";
        albumPhysicalAggregated.set(releaseId, {
          release_id: releaseId,
          release_title: release.title || "Unknown Album",
          band_name: bandName,
          total_sales: sale.quantity_sold,
          release_type: release.release_type || "album",
        });
      }
    }

    // Create album physical sales chart entries (only for albums/EPs, not singles)
    // Now that we have a partial unique index for album entries, we can insert these
    const albumPhysicalEntries = Array.from(albumPhysicalAggregated.values())
      .filter(entry => entry.release_type === "album" || entry.release_type === "ep")
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 50)
      .map((entry, index) => ({
        release_id: entry.release_id,
        song_id: null, // Album entries use release_id instead
        chart_type: "record_sales_album",
        rank: index + 1,
        plays_count: entry.total_sales,
        chart_date: chartDate,
        genre: null,
        country: "all",
        sale_type: "physical",
        entry_type: "album",
      }));

    chartEntries.push(...albumPhysicalEntries);
    console.log(`Generated ${albumPhysicalEntries.length} album physical sales entries`);

    // === RADIO AIRPLAY CHARTS (ALL songs) ===
    const { data: radioPlays, error: radioError } = await supabaseClient
      .from("radio_plays")
      .select(`
        song_id,
        listeners,
        songs!inner(
          id,
          title,
          genre,
          user_id,
          band_id,
          status
        )
      `)
      .gte("played_at", sevenDaysAgo.toISOString());

    if (radioError) {
      console.error("Error fetching radio plays:", radioError);
    }

    console.log(`Fetched ${radioPlays?.length || 0} radio play entries`);

    // Aggregate by song - ALL songs with radio plays
    const radioAggregated = new Map<string, any>();
    for (const play of radioPlays || []) {
      const existing = radioAggregated.get(play.song_id);
      if (existing) {
        existing.total_listeners += play.listeners || 0;
        existing.play_count += 1;
      } else {
        radioAggregated.set(play.song_id, {
          song_id: play.song_id,
          total_listeners: play.listeners || 0,
          play_count: 1,
          song: play.songs,
        });
      }
    }

    const radioEntries = Array.from(radioAggregated.values())
      .sort((a, b) => b.total_listeners - a.total_listeners)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.song_id,
        chart_type: "radio_airplay",
        rank: index + 1,
        plays_count: entry.total_listeners,
        chart_date: chartDate,
        genre: entry.song?.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...radioEntries);
    console.log(`Generated ${radioEntries.length} radio airplay entries`);

    // === VIDEO VIEWS CHARTS (ALL released videos) ===
    const { data: videoData, error: videoError } = await supabaseClient
      .from("music_videos")
      .select(`
        id,
        song_id,
        views_count,
        songs!inner(
          id,
          title,
          genre,
          user_id,
          band_id,
          status
        )
      `)
      .eq("status", "released")
      .gte("views_count", 0)
      .order("views_count", { ascending: false })
      .limit(100);

    if (videoError) {
      console.error("Error fetching video data:", videoError);
    }

    console.log(`Fetched ${videoData?.length || 0} video entries`);

    const videoEntries = (videoData || []).map((video, index) => ({
      song_id: video.song_id,
      chart_type: "video_views",
      rank: index + 1,
      plays_count: video.views_count,
      chart_date: chartDate,
      genre: (video.songs as any)?.genre,
      country: "all",
      entry_type: "song",
    }));

    chartEntries.push(...videoEntries);
    console.log(`Generated ${videoEntries.length} video views entries`);

    // === ALBUM STREAMING CHARTS (aggregate all songs per album) ===
    const { data: albumStreamingData, error: albumStreamingError } = await supabaseClient
      .from("song_releases")
      .select(`
        song_id,
        total_streams,
        release_id,
        release:releases!inner(
          id,
          title,
          release_type,
          band_id,
          bands(name, artist_name)
        ),
        songs!inner(
          id,
          title,
          genre,
          status
        )
      `)
      .eq("is_active", true)
      .eq("songs.status", "released")
      .eq("release.release_type", "album")
      .gte("total_streams", 0);

    if (albumStreamingError) {
      console.error("Error fetching album streaming data:", albumStreamingError);
    }

    console.log(`Fetched ${albumStreamingData?.length || 0} album song entries for aggregation`);

    // Aggregate streams by release_id (album)
    const albumAggregated = new Map<string, {
      release_id: string;
      release_title: string;
      band_name: string;
      total_streams: number;
      genre: string;
      song_count: number;
    }>();

    for (const entry of albumStreamingData || []) {
      const releaseId = entry.release?.id;
      if (!releaseId) continue;

      const existing = albumAggregated.get(releaseId);
      if (existing) {
        existing.total_streams += entry.total_streams || 0;
        existing.song_count += 1;
      } else {
        const bandName = entry.release?.bands?.artist_name || entry.release?.bands?.name || "Unknown Artist";
        albumAggregated.set(releaseId, {
          release_id: releaseId,
          release_title: entry.release?.title || "Unknown Album",
          band_name: bandName,
          total_streams: entry.total_streams || 0,
          genre: entry.songs?.genre || "Unknown",
          song_count: 1,
        });
      }
    }

    // Create album streaming chart entries - now possible with partial unique index
    const albumStreamingEntries = Array.from(albumAggregated.values())
      .sort((a, b) => b.total_streams - a.total_streams)
      .slice(0, 50)
      .map((entry, index) => ({
        release_id: entry.release_id,
        song_id: null, // Album entries use release_id instead
        chart_type: "streaming_album",
        rank: index + 1,
        plays_count: entry.total_streams,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "album",
      }));

    chartEntries.push(...albumStreamingEntries);
    console.log(`Generated ${albumStreamingEntries.length} album streaming chart entries`);

    // Log summary before insert
    console.log(`Total chart entries to insert: ${chartEntries.length}`);
    console.log(`Breakdown: streaming=${streamingEntries.length}, sales entries by type, radio=${radioEntries.length}, video=${videoEntries.length}`);

    // NOW: Delete old entries and insert new ones (atomic operation)
    if (chartEntries.length > 0) {
      // Delete today's chart entries
      const { error: deleteError } = await supabaseClient
        .from("chart_entries")
        .delete()
        .eq("chart_date", chartDate);

      if (deleteError) {
        console.error("Error deleting old chart entries:", deleteError);
        throw deleteError;
      }

      console.log(`Deleted old entries for ${chartDate}`);

      // Filter out any entries with null song_id (can't use unique constraint)
      const validEntries = chartEntries.filter(e => e.song_id !== null);
      console.log(`Inserting ${validEntries.length} valid entries (filtered out ${chartEntries.length - validEntries.length} with null song_id)`);

      // Insert all new entries using upsert to handle unique constraints
      const { data: insertedData, error: insertError } = await supabaseClient
        .from("chart_entries")
        .upsert(validEntries, { 
          onConflict: "song_id,chart_type,chart_date",
          ignoreDuplicates: true 
        })
        .select("id");

      if (insertError) {
        console.error("Error inserting chart entries:", insertError);
        throw insertError;
      }

      chartsUpdated = insertedData?.length || validEntries.length;
      console.log(`Successfully inserted/updated ${chartsUpdated} chart entries`);
    }

    console.log(`Updated ${chartsUpdated} chart entries total (streaming, sales, radio, video)`);

    // Calculate trends based on yesterday's chart
    try {
      await supabaseClient.rpc("calculate_chart_trends");
    } catch (trendError) {
      console.error("Error calculating trends:", trendError);
      // Don't fail the whole job for trend calculation
    }

    await completeJobRun({
      jobName: "update-music-charts",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: chartsUpdated,
      resultSummary: { chartsUpdated, chartDate },
    });

    return new Response(
      JSON.stringify({ success: true, chartsUpdated, chartDate }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await failJobRun({
      jobName: "update-music-charts",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { chartsUpdated },
    });

    console.error("Error updating charts:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
