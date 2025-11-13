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

    // Clear today's chart entries
    await supabaseClient
      .from("chart_entries")
      .delete()
      .eq("chart_date", chartDate);

    // === STREAMING CHARTS ===
    const { data: streamingData } = await supabaseClient
      .from("song_releases")
      .select(`
        song_id,
        total_streams,
        songs!inner(
          id,
          title,
          genre,
          user_id,
          band_id
        )
      `)
      .eq("is_active", true)
      .gte("total_streams", 100) // Minimum streams to chart
      .order("total_streams", { ascending: false })
      .limit(100);

    // Aggregate by song (multiple platforms)
    const streamingAggregated = new Map<string, any>();
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
      }));

    if (streamingEntries.length > 0) {
      await supabaseClient.from("chart_entries").insert(streamingEntries);
      chartsUpdated += streamingEntries.length;
    }

    // === SALES CHARTS ===
    const salesTypes = [
      { type: "digital_sales", format: "digital" },
      { type: "cd_sales", format: "cd" },
      { type: "vinyl_sales", format: "vinyl" },
    ];

    for (const salesType of salesTypes) {
      // Get sales from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: salesData } = await supabaseClient
        .from("release_sales")
        .select(`
          release_format_id,
          quantity_sold,
          release_formats!inner(
            format_type,
            release:releases!inner(
              id,
              release_songs!inner(
                song:songs!inner(
                  id,
                  title,
                  genre,
                  user_id,
                  band_id
                )
              )
            )
          )
        `)
        .eq("release_formats.format_type", salesType.format)
        .gte("sale_date", sevenDaysAgo.toISOString())
        .order("quantity_sold", { ascending: false });

      // Aggregate by song
      const songSales = new Map<string, number>();
      const songInfo = new Map<string, any>();

      for (const sale of salesData || []) {
        const release = sale.release_formats?.release;
        if (!release || !release.release_songs) continue;

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
          };
        });

      if (salesEntries.length > 0) {
        await supabaseClient.from("chart_entries").insert(salesEntries);
        chartsUpdated += salesEntries.length;
      }
    }

    // === OVERALL RECORD SALES (physical combined) ===
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recordSales } = await supabaseClient
      .from("release_sales")
      .select(`
        release_format_id,
        quantity_sold,
        release_formats!inner(
          format_type,
          release:releases!inner(
            id,
            release_songs!inner(
              song:songs!inner(
                id,
                title,
                genre,
                user_id,
                band_id
              )
            )
          )
        )
      `)
      .in("release_formats.format_type", ["cd", "vinyl", "cassette"])
      .gte("sale_date", sevenDaysAgo.toISOString());

    const recordSongSales = new Map<string, number>();
    const recordSongInfo = new Map<string, any>();

    for (const sale of recordSales || []) {
      const release = sale.release_formats?.release;
      if (!release || !release.release_songs) continue;

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
        };
      });

    if (recordEntries.length > 0) {
      await supabaseClient.from("chart_entries").insert(recordEntries);
      chartsUpdated += recordEntries.length;
    }

    console.log(`Updated ${chartsUpdated} chart entries`);

    // Calculate trends based on yesterday's chart
    await supabaseClient.rpc("calculate_chart_trends");

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
