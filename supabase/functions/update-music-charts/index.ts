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

// Industry-standard chart calculation:
// 150 streams = 1 chart unit (Billboard/UK Official Charts standard)
const STREAM_TO_UNIT_RATIO = 150;

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
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const RELEASE_SCOPES = ["single", "ep", "album"] as const;
    type ReleaseScope = (typeof RELEASE_SCOPES)[number];

    const toReleaseScope = (value: unknown): ReleaseScope => {
      return RELEASE_SCOPES.includes(value as ReleaseScope)
        ? (value as ReleaseScope)
        : "single";
    };

    const scopedType = (base: string, scope: ReleaseScope) => `${base}_${scope}`;

    console.log(`Starting chart generation for ${chartDate}`);

    // =========================================================================
    // STEP 1: Collect weekly streams from streaming_analytics_daily
    // FIXED: Using correct column names: song_release_id, daily_streams
    // =========================================================================
    // FIXED: Removed broken nested filter - Supabase doesn't support .eq() on deeply nested relations
    // We fetch all data and filter in code instead
    const { data: weeklyStreamDataRaw, error: weeklyStreamError } = await supabaseClient
      .from("streaming_analytics_daily")
      .select(`
        song_release_id,
        daily_streams,
        listener_region,
        song_releases(
          song_id,
          songs(
            id,
            title,
            genre,
            user_id,
            band_id,
            status
          )
        )
      `)
      .gte("analytics_date", sevenDaysAgo.toISOString().split("T")[0]);

    if (weeklyStreamError) {
      console.error("Error fetching weekly streaming data:", weeklyStreamError);
    }

    // Filter to only include songs with status = 'recorded' in code
    const weeklyStreamData = (weeklyStreamDataRaw || []).filter(
      entry => entry.song_releases?.songs?.status === "recorded"
    );

    console.log(`Fetched ${weeklyStreamData?.length || 0} streaming analytics entries`);

    // Aggregate weekly streams by song AND by region
    const weeklyStreamsMap = new Map<string, number>();
    const weeklyStreamsByRegion = new Map<string, Map<string, number>>(); // region -> (songId -> streams)
    const uniqueRegions = new Set<string>();
    const songInfoMap = new Map<string, any>();

    for (const entry of weeklyStreamData || []) {
      const songId = entry.song_releases?.song_id;
      if (!songId) continue;

      const streams = entry.daily_streams || 0;
      const region = entry.listener_region || "all";

      // Global aggregate
      const current = weeklyStreamsMap.get(songId) || 0;
      weeklyStreamsMap.set(songId, current + streams);

      // Per-region aggregate
      if (region && region !== "all") {
        uniqueRegions.add(region);
        if (!weeklyStreamsByRegion.has(region)) {
          weeklyStreamsByRegion.set(region, new Map());
        }
        const regionMap = weeklyStreamsByRegion.get(region)!;
        const regionCurrent = regionMap.get(songId) || 0;
        regionMap.set(songId, regionCurrent + streams);
      }

      // Store song info
      if (!songInfoMap.has(songId) && entry.song_releases?.songs) {
        songInfoMap.set(songId, entry.song_releases.songs);
      }
    }
    
    console.log(`Aggregated weekly streams for ${weeklyStreamsMap.size} songs across ${uniqueRegions.size} regions`);

    // =========================================================================
    // STEP 2: Get total streams from song_releases for all-time totals
    // FIXED: status filter from 'released' to 'recorded'
    // =========================================================================
    // FIXED: Removed broken nested filter - filter in code instead
    // FIXED: Use explicit foreign key for release_songs to avoid ambiguity
    const { data: streamingDataRaw, error: streamingError } = await supabaseClient
      .from("song_releases")
      .select(`
        song_id,
        total_streams,
        release_id,
        release:releases(
          id,
          title,
          release_type,
          band_id,
          bands(name, artist_name),
          release_songs:release_songs!release_songs_release_id_fkey(
            song_id,
            track_number
          )
        ),
        songs(
          id,
          title,
          genre,
          user_id,
          band_id,
          status
        )
      `)
      .eq("is_active", true)
      .gte("total_streams", 0)
      .order("total_streams", { ascending: false })
      .limit(500);

    if (streamingError) {
      console.error("Error fetching streaming data:", streamingError);
    }

    // Filter to only include songs with status = 'recorded'
    const streamingData = (streamingDataRaw || []).filter(
      entry => entry.songs?.status === "recorded"
    );

    console.log(`Fetched ${streamingData?.length || 0} streaming entries`);

    // Aggregate by song (multiple platforms)
    const streamingAggregated = new Map<string, any>();
    const streamingAggregatedByScope = new Map<string, any>();

    for (const entry of streamingData || []) {
      const existing = streamingAggregated.get(entry.song_id);
      const weeklyStreams = weeklyStreamsMap.get(entry.song_id) || 0;
      
      if (existing) {
        existing.total_streams += entry.total_streams;
      } else {
        streamingAggregated.set(entry.song_id, {
          song_id: entry.song_id,
          total_streams: entry.total_streams,
          weekly_streams: weeklyStreams,
          song: entry.songs,
        });
      }

      // Also store in songInfoMap if not already
      if (!songInfoMap.has(entry.song_id) && entry.songs) {
        songInfoMap.set(entry.song_id, entry.songs);
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
          weekly_streams: weeklyStreams,
          song: entry.songs,
        });
      }
    }

    // Helper function to create chart entries for a given country
    const createStreamingEntries = (
      dataMap: Map<string, any>,
      country: string,
      chartTypeName: string
    ) => {
      return Array.from(dataMap.values())
        .sort((a, b) => b.weekly_streams - a.weekly_streams)
        .slice(0, 100)
        .map((entry, index) => ({
          song_id: entry.song_id,
          chart_type: chartTypeName,
          rank: index + 1,
          plays_count: entry.total_streams,
          weekly_plays: entry.weekly_streams,
          combined_score: 0,
          chart_date: chartDate,
          genre: entry.song?.genre,
          country: country,
          entry_type: "song",
        }));
    };

    // Create global streaming chart entries
    const streamingEntries = createStreamingEntries(streamingAggregated, "all", "streaming");
    chartEntries.push(...streamingEntries);

    // Create per-region streaming chart entries
    for (const region of uniqueRegions) {
      const regionStreams = weeklyStreamsByRegion.get(region);
      if (!regionStreams || regionStreams.size === 0) continue;

      // Build data for this region
      const regionData = new Map<string, any>();
      for (const [songId, streams] of regionStreams) {
        const globalData = streamingAggregated.get(songId);
        if (globalData) {
          regionData.set(songId, {
            ...globalData,
            weekly_streams: streams,
          });
        }
      }

      const regionEntries = createStreamingEntries(regionData, region, "streaming");
      chartEntries.push(...regionEntries);
    }

    // Create scoped streaming entries for singles only (individual song entries)
    const streamingSingleEntries = Array.from(streamingAggregatedByScope.values())
      .filter((entry) => entry.scope === "single")
      .sort((a, b) => b.weekly_streams - a.weekly_streams)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.song_id,
        chart_type: scopedType("streaming", entry.scope),
        rank: index + 1,
        plays_count: entry.total_streams,
        weekly_plays: entry.weekly_streams,
        combined_score: 0,
        chart_date: chartDate,
        genre: entry.song?.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...streamingSingleEntries);
    console.log(`Generated ${streamingEntries.length} streaming entries, ${streamingSingleEntries.length} single entries, ${uniqueRegions.size} region charts`);

    // =========================================================================
    // STEP 2b: Album/EP streaming charts - aggregate by release_id
    // Sum all song streams for each album/EP and create one entry per release
    // =========================================================================
    const albumStreamingAggregated = new Map<string, {
      releaseId: string;
      releaseTitle: string;
      releaseType: ReleaseScope;
      totalStreams: number;
      weeklyStreams: number;
      leadSongId: string | null;
      bandName: string;
      genre: string;
    }>();

    for (const entry of streamingData || []) {
      const release = (entry as any).release;
      if (!release) continue;
      
      const releaseType = toReleaseScope(release.release_type);
      // Only aggregate albums and EPs
      if (releaseType !== "album" && releaseType !== "ep") continue;

      const releaseId = entry.release_id;
      if (!releaseId) continue;

      const weeklyStreams = weeklyStreamsMap.get(entry.song_id) || 0;
      const totalStreams = entry.total_streams || 0;

      const existing = albumStreamingAggregated.get(releaseId);
      if (existing) {
        existing.totalStreams += totalStreams;
        existing.weeklyStreams += weeklyStreams;
      } else {
        // Get lead song (track 1)
        const releaseSongs = release.release_songs || [];
        const sortedSongs = [...releaseSongs].sort((a: any, b: any) => (a.track_number || 0) - (b.track_number || 0));
        const leadSongId = sortedSongs[0]?.song_id || entry.song_id;

        const bandName = release.bands?.artist_name || release.bands?.name || "Unknown Artist";

        albumStreamingAggregated.set(releaseId, {
          releaseId,
          releaseTitle: release.title || "Unknown Album",
          releaseType,
          totalStreams,
          weeklyStreams,
          leadSongId,
          bandName,
          genre: entry.songs?.genre || "Unknown",
        });
      }
    }

    // Create streaming_album entries
    const streamingAlbumEntries = Array.from(albumStreamingAggregated.values())
      .filter((entry) => entry.releaseType === "album" && entry.leadSongId)
      .sort((a, b) => b.weeklyStreams - a.weeklyStreams)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.leadSongId!,
        release_id: entry.releaseId,
        release_title: entry.releaseTitle,
        chart_type: "streaming_album",
        rank: index + 1,
        plays_count: entry.totalStreams,
        weekly_plays: entry.weeklyStreams,
        combined_score: 0,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "album",
      }));

    chartEntries.push(...streamingAlbumEntries);
    console.log(`Generated ${streamingAlbumEntries.length} streaming_album entries`);

    // Create streaming_ep entries
    const streamingEpEntries = Array.from(albumStreamingAggregated.values())
      .filter((entry) => entry.releaseType === "ep" && entry.leadSongId)
      .sort((a, b) => b.weeklyStreams - a.weeklyStreams)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.leadSongId!,
        release_id: entry.releaseId,
        release_title: entry.releaseTitle,
        chart_type: "streaming_ep",
        rank: index + 1,
        plays_count: entry.totalStreams,
        weekly_plays: entry.weeklyStreams,
        combined_score: 0,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "album",
      }));

    chartEntries.push(...streamingEpEntries);
    console.log(`Generated ${streamingEpEntries.length} streaming_ep entries`);

    // =========================================================================
    // STEP 3: Collect weekly sales by format
    // =========================================================================
    const salesTypes = [
      { type: "digital_sales", format: "digital" },
      { type: "cd_sales", format: "cd" },
      { type: "vinyl_sales", format: "vinyl" },
      { type: "cassette_sales", format: "cassette" },
    ];

    // Store sales data for combined chart calculation
    const weeklySalesMap = new Map<string, {
      digital: number;
      cd: number;
      vinyl: number;
      cassette: number;
      totalPhysical: number;
    }>();

    for (const salesType of salesTypes) {
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

      // Aggregate by song
      const songSales = new Map<string, number>();
      const songInfo = new Map<string, any>();
      const songSalesByScope = new Map<string, number>();
      const songInfoByScope = new Map<string, any>();
      
      // Album/EP aggregation: aggregate sales by release_id for albums/EPs
      const albumSalesAgg = new Map<string, {
        releaseId: string;
        releaseTitle: string;
        releaseType: ReleaseScope;
        totalSales: number;
        leadSongId: string | null;
        genre: string;
      }>();

      for (const sale of salesData || []) {
        const release = sale.release_formats?.release;
        if (!release || !release.release_songs) continue;

        const scope = toReleaseScope((release as any)?.release_type);
        const releaseId = release.id;
        
        // Get all songs and find lead song (track 1)
        const releaseSongs = release.release_songs || [];
        const sortedSongs = [...releaseSongs].sort((a: any, b: any) => {
          const aTrack = (a as any).track_number || 0;
          const bTrack = (b as any).track_number || 0;
          return aTrack - bTrack;
        });
        const leadSong = sortedSongs[0]?.song;
        const leadSongId = leadSong?.id || null;

        for (const releaseSong of release.release_songs) {
          const song = releaseSong.song;
          if (!song) continue;

          const currentSales = songSales.get(song.id) || 0;
          songSales.set(song.id, currentSales + sale.quantity_sold);

          // Track for combined chart
          const existingSales = weeklySalesMap.get(song.id) || {
            digital: 0, cd: 0, vinyl: 0, cassette: 0, totalPhysical: 0
          };
          if (salesType.format === "digital") {
            existingSales.digital += sale.quantity_sold;
          } else if (salesType.format === "cd") {
            existingSales.cd += sale.quantity_sold;
            existingSales.totalPhysical += sale.quantity_sold;
          } else if (salesType.format === "vinyl") {
            existingSales.vinyl += sale.quantity_sold;
            existingSales.totalPhysical += sale.quantity_sold;
          } else if (salesType.format === "cassette") {
            existingSales.cassette += sale.quantity_sold;
            existingSales.totalPhysical += sale.quantity_sold;
          }
          weeklySalesMap.set(song.id, existingSales);

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
        
        // Aggregate for album/EP charts (one entry per release)
        if ((scope === "album" || scope === "ep") && releaseId && leadSongId) {
          const existing = albumSalesAgg.get(releaseId);
          if (existing) {
            existing.totalSales += sale.quantity_sold;
          } else {
            albumSalesAgg.set(releaseId, {
              releaseId,
              releaseTitle: (release as any).title || "Unknown Album",
              releaseType: scope,
              totalSales: sale.quantity_sold,
              leadSongId,
              genre: leadSong?.genre || "Unknown",
            });
          }
        }
      }

      // Create format-specific chart entries (base type - all songs)
      const salesEntries = Array.from(songSales.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([songId, sales], index) => {
          const info = songInfo.get(songId);
          return {
            song_id: songId,
            chart_type: salesType.type,
            rank: index + 1,
            plays_count: sales, // Total weekly sales for this format
            weekly_plays: sales, // Weekly is same as total for sales charts
            combined_score: 0,
            chart_date: chartDate,
            genre: info?.genre,
            country: "all",
            sale_type: salesType.format,
            entry_type: "song",
          };
        });

      chartEntries.push(...salesEntries);

      // Create scoped entries for singles (individual songs)
      const scopedSalesEntries = Array.from(songSalesByScope.entries())
        .filter(([scopedKey]) => scopedKey.endsWith(":single"))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100)
        .map(([scopedKey, sales], index) => {
          const [songId] = scopedKey.split(":");
          const info = songInfoByScope.get(scopedKey);
          return {
            song_id: songId,
            chart_type: scopedType(salesType.type, "single"),
            rank: index + 1,
            plays_count: sales,
            weekly_plays: sales,
            combined_score: 0,
            chart_date: chartDate,
            genre: info?.genre,
            country: "all",
            sale_type: salesType.format,
            entry_type: "song",
          };
        });

      chartEntries.push(...scopedSalesEntries);
      
      // Create album chart entries (aggregated by release)
      const albumSalesEntries = Array.from(albumSalesAgg.values())
        .filter((entry) => entry.releaseType === "album" && entry.leadSongId)
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 100)
        .map((entry, index) => ({
          song_id: entry.leadSongId!,
          release_id: entry.releaseId,
          release_title: entry.releaseTitle,
          chart_type: scopedType(salesType.type, "album"),
          rank: index + 1,
          plays_count: entry.totalSales,
          weekly_plays: entry.totalSales,
          combined_score: 0,
          chart_date: chartDate,
          genre: entry.genre,
          country: "all",
          sale_type: salesType.format,
          entry_type: "album",
        }));

      chartEntries.push(...albumSalesEntries);
      
      // Create EP chart entries (aggregated by release)
      const epSalesEntries = Array.from(albumSalesAgg.values())
        .filter((entry) => entry.releaseType === "ep" && entry.leadSongId)
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, 100)
        .map((entry, index) => ({
          song_id: entry.leadSongId!,
          release_id: entry.releaseId,
          release_title: entry.releaseTitle,
          chart_type: scopedType(salesType.type, "ep"),
          rank: index + 1,
          plays_count: entry.totalSales,
          weekly_plays: entry.totalSales,
          combined_score: 0,
          chart_date: chartDate,
          genre: entry.genre,
          country: "all",
          sale_type: salesType.format,
          entry_type: "album",
        }));

      chartEntries.push(...epSalesEntries);
      
      console.log(`Generated ${salesEntries.length} ${salesType.type} entries, ${scopedSalesEntries.length} single, ${albumSalesEntries.length} album, ${epSalesEntries.length} ep`);
    }

    // =========================================================================
    // STEP 4: Generate COMBINED chart (industry-standard weighted formula)
    // Formula: (weekly_streams / 150) + digital_sales + cd_sales + vinyl_sales + cassette_sales
    // =========================================================================
    const combinedScores = new Map<string, {
      songId: string;
      combinedScore: number;
      weeklyStreams: number;
      digitalSales: number;
      physicalSales: number;
      genre: string;
    }>();

    // Get all songs that have either streams or sales
    const allSongIds = new Set([
      ...weeklyStreamsMap.keys(),
      ...weeklySalesMap.keys(),
    ]);

    for (const songId of allSongIds) {
      const weeklyStreams = weeklyStreamsMap.get(songId) || 0;
      const sales = weeklySalesMap.get(songId) || {
        digital: 0, cd: 0, vinyl: 0, cassette: 0, totalPhysical: 0
      };

      // Industry formula: 150 streams = 1 unit
      const streamUnits = Math.floor(weeklyStreams / STREAM_TO_UNIT_RATIO);
      const combinedScore = streamUnits + sales.digital + sales.cd + sales.vinyl + sales.cassette;

      if (combinedScore > 0) {
        const songInfo = songInfoMap.get(songId);
        combinedScores.set(songId, {
          songId,
          combinedScore,
          weeklyStreams,
          digitalSales: sales.digital,
          physicalSales: sales.totalPhysical,
          genre: songInfo?.genre || "Unknown",
        });
      }
    }

    // Create combined chart entries (base combined chart for all songs)
    const combinedEntries = Array.from(combinedScores.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.songId,
        chart_type: "combined",
        rank: index + 1,
        plays_count: entry.weeklyStreams, // Store weekly streams as plays_count for display
        weekly_plays: entry.weeklyStreams,
        combined_score: entry.combinedScore,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...combinedEntries);
    console.log(`Generated ${combinedEntries.length} combined chart entries`);

    // Create combined_single entries
    const combinedSingleEntries = Array.from(combinedScores.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.songId,
        chart_type: "combined_single",
        rank: index + 1,
        plays_count: entry.weeklyStreams,
        weekly_plays: entry.weeklyStreams,
        combined_score: entry.combinedScore,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...combinedSingleEntries);
    console.log(`Generated ${combinedSingleEntries.length} combined_single entries`);

    // =========================================================================
    // STEP 4b: Combined album/EP charts - aggregate by release_id
    // =========================================================================
    const albumCombinedScores = new Map<string, {
      releaseId: string;
      releaseTitle: string;
      releaseType: ReleaseScope;
      combinedScore: number;
      weeklyStreams: number;
      leadSongId: string | null;
      genre: string;
    }>();

    // Use the already aggregated album streaming data and add sales
    for (const [releaseId, albumData] of albumStreamingAggregated) {
      const streamUnits = Math.floor(albumData.weeklyStreams / STREAM_TO_UNIT_RATIO);
      
      // For now, album combined score is based on aggregated streams
      // Sales are already per-song, so we'd need to aggregate those too
      const combinedScore = streamUnits;

      if (combinedScore > 0) {
        albumCombinedScores.set(releaseId, {
          releaseId,
          releaseTitle: albumData.releaseTitle,
          releaseType: albumData.releaseType,
          combinedScore,
          weeklyStreams: albumData.weeklyStreams,
          leadSongId: albumData.leadSongId,
          genre: albumData.genre,
        });
      }
    }

    // Create combined_album entries
    const combinedAlbumEntries = Array.from(albumCombinedScores.values())
      .filter((entry) => entry.releaseType === "album" && entry.leadSongId)
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.leadSongId!,
        release_id: entry.releaseId,
        release_title: entry.releaseTitle,
        chart_type: "combined_album",
        rank: index + 1,
        plays_count: entry.weeklyStreams,
        weekly_plays: entry.weeklyStreams,
        combined_score: entry.combinedScore,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "album",
      }));

    chartEntries.push(...combinedAlbumEntries);
    console.log(`Generated ${combinedAlbumEntries.length} combined_album entries`);

    // Create combined_ep entries
    const combinedEpEntries = Array.from(albumCombinedScores.values())
      .filter((entry) => entry.releaseType === "ep" && entry.leadSongId)
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.leadSongId!,
        release_id: entry.releaseId,
        release_title: entry.releaseTitle,
        chart_type: "combined_ep",
        rank: index + 1,
        plays_count: entry.weeklyStreams,
        weekly_plays: entry.weeklyStreams,
        combined_score: entry.combinedScore,
        chart_date: chartDate,
        genre: entry.genre,
        country: "all",
        entry_type: "album",
      }));

    chartEntries.push(...combinedEpEntries);
    console.log(`Generated ${combinedEpEntries.length} combined_ep entries`);

    // =========================================================================
    // STEP 5: Record sales (combined physical)
    // =========================================================================
    const recordSongSales = new Map<string, number>();
    const recordSongInfo = new Map<string, any>();

    for (const [songId, sales] of weeklySalesMap) {
      const physicalTotal = sales.cd + sales.vinyl + sales.cassette;
      if (physicalTotal > 0) {
        recordSongSales.set(songId, physicalTotal);
        const info = songInfoMap.get(songId);
        if (info) {
          recordSongInfo.set(songId, info);
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
          weekly_plays: sales,
          combined_score: 0,
          chart_date: chartDate,
          genre: info?.genre,
          country: "all",
          sale_type: "physical",
          entry_type: "song",
        };
      });

    chartEntries.push(...recordEntries);
    console.log(`Generated ${recordEntries.length} record sales entries`);

    // =========================================================================
    // STEP 6: Album physical sales charts
    // FIXED: Include a lead song_id for each release (song_id is NOT NULL in chart_entries)
    // =========================================================================
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
            bands(name, artist_name),
            release_songs:release_songs!release_songs_release_id_fkey(
              song_id,
              track_number
            )
          )
        )
      `)
      .in("release_formats.format_type", ["cd", "vinyl", "cassette"])
      .gte("sale_date", sevenDaysAgo.toISOString());

    if (albumPhysicalError) {
      console.error("Error fetching album physical sales:", albumPhysicalError);
    }

    // Aggregate by release
    const albumSales = new Map<string, { quantity: number; release: any; leadSongId: string | null }>();
    for (const sale of albumPhysicalSales || []) {
      const releaseId = sale.release_formats?.release_id;
      const release = sale.release_formats?.release;
      if (!releaseId || !release) continue;

      // Get lead song (first track) for the release
      const releaseSongs = (release as any).release_songs || [];
      const sortedSongs = releaseSongs.sort((a: any, b: any) => (a.track_number || 0) - (b.track_number || 0));
      const leadSongId = sortedSongs[0]?.song_id || null;

      const existing = albumSales.get(releaseId);
      if (existing) {
        existing.quantity += sale.quantity_sold;
      } else {
        albumSales.set(releaseId, { quantity: sale.quantity_sold, release, leadSongId });
      }
    }

    // Only create entries for albums that have a lead song (song_id is required)
    const albumPhysicalEntries = Array.from(albumSales.entries())
      .filter(([_, data]) => data.leadSongId !== null)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 100)
      .map(([releaseId, data], index) => ({
        song_id: data.leadSongId!, // Lead song of the album
        release_id: releaseId,
        release_title: data.release.title || "Unknown Album",
        chart_type: "album_physical",
        rank: index + 1,
        plays_count: data.quantity,
        weekly_plays: data.quantity,
        combined_score: 0,
        chart_date: chartDate,
        country: "all",
        entry_type: "album",
      }));

    chartEntries.push(...albumPhysicalEntries);
    console.log(`Generated ${albumPhysicalEntries.length} album physical entries`);

    // =========================================================================
    // STEP 7: Radio airplay charts
    // =========================================================================
    // FIXED: Query radio_plays table (has listeners column) instead of radio_playlists
    // radio_playlists only has: id, show_id, song_id, week_start_date, times_played, added_at, removed_at, is_active
    // radio_plays has: id, playlist_id, song_id, show_id, station_id, played_at, listeners, hype_gained, etc.
    const { data: radioDataRaw, error: radioError } = await supabaseClient
      .from("radio_plays")
      .select(`
        song_id,
        listeners,
        played_at,
        songs(
          id,
          title,
          genre,
          status
        )
      `)
      .gte("played_at", sevenDaysAgo.toISOString());

    if (radioError) {
      console.error("Error fetching radio data:", radioError);
    }

    // Filter to only include songs with status = 'recorded'
    const radioData = (radioDataRaw || []).filter(
      entry => entry.songs?.status === "recorded"
    );

    console.log(`Fetched ${radioData?.length || 0} radio play entries`);

    // Aggregate radio plays by song - count each play and sum listeners
    const radioAggregated = new Map<string, { listeners: number; plays: number; song: any }>();
    for (const entry of radioData || []) {
      const existing = radioAggregated.get(entry.song_id);
      if (existing) {
        existing.listeners += entry.listeners || 0;
        existing.plays += 1; // Count each radio play
      } else {
        radioAggregated.set(entry.song_id, {
          listeners: entry.listeners || 0,
          plays: 1,
          song: entry.songs,
        });
      }
    }

    const radioEntries = Array.from(radioAggregated.values())
      .sort((a, b) => b.listeners - a.listeners)
      .slice(0, 100)
      .map((entry, index) => ({
        song_id: entry.song.id,
        chart_type: "radio_airplay",
        rank: index + 1,
        plays_count: entry.plays, // Number of radio plays
        weekly_plays: entry.listeners, // Total listeners reached
        combined_score: 0,
        chart_date: chartDate,
        genre: entry.song?.genre,
        country: "all",
        entry_type: "song",
      }));

    chartEntries.push(...radioEntries);
    console.log(`Generated ${radioEntries.length} radio airplay entries`);

    // Create radio_airplay_single entries (all radio plays are for singles currently)
    const radioSingleEntries = radioEntries.map((entry, index) => ({
      ...entry,
      chart_type: "radio_airplay_single",
      rank: index + 1,
    }));
    chartEntries.push(...radioSingleEntries);
    console.log(`Generated ${radioSingleEntries.length} radio_airplay_single entries`);

    // =========================================================================
    // STEP 8: Upsert all chart entries
    // =========================================================================
    if (chartEntries.length > 0) {
      // Deduplicate entries (keep the one with highest rank/score for each song+chart_type combo)
      const dedupeMap = new Map<string, any>();
      for (const entry of chartEntries) {
        const key = `${entry.song_id || entry.release_id}:${entry.chart_type}:${entry.chart_date}`;
        const existing = dedupeMap.get(key);
        if (!existing || (entry.combined_score || 0) > (existing.combined_score || 0) || (entry.plays_count || 0) > (existing.plays_count || 0)) {
          dedupeMap.set(key, entry);
        }
      }
      const dedupedEntries = Array.from(dedupeMap.values());
      console.log(`Deduped ${chartEntries.length} -> ${dedupedEntries.length} chart entries`);

      // Delete old entries for today first to avoid duplicates
      const { error: deleteError, count: deleteCount } = await supabaseClient
        .from("chart_entries")
        .delete()
        .eq("chart_date", chartDate)
        .select("id", { count: "exact", head: true });

      console.log(`Deleted ${deleteCount ?? 'unknown'} old entries for ${chartDate}${deleteError ? `, error: ${JSON.stringify(deleteError)}` : ''}`);

      // Insert in batches to avoid payload limits
      const BATCH_SIZE = 200;
      for (let i = 0; i < dedupedEntries.length; i += BATCH_SIZE) {
        const batch = dedupedEntries.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabaseClient
          .from("chart_entries")
          .insert(batch);

        if (insertError) {
          console.error(`Error inserting chart entries batch ${i / BATCH_SIZE + 1}:`, JSON.stringify(insertError));
          throw insertError;
        }
      }

      chartsUpdated = chartEntries.length;
      console.log(`Successfully inserted ${chartsUpdated} chart entries`);
    }

    // =========================================================================
    // STEP 9: Update trends (compare with yesterday)
    // =========================================================================
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: yesterdayEntries } = await supabaseClient
      .from("chart_entries")
      .select("song_id, chart_type, rank, country")
      .eq("chart_date", yesterdayStr);

    if (yesterdayEntries && yesterdayEntries.length > 0) {
      const yesterdayMap = new Map<string, number>();
      for (const entry of yesterdayEntries) {
        const key = `${entry.song_id}:${entry.chart_type}:${entry.country || 'all'}`;
        yesterdayMap.set(key, entry.rank);
      }

      // Update trends for today's entries
      for (const entry of chartEntries) {
        const key = `${entry.song_id}:${entry.chart_type}:${entry.country || 'all'}`;
        const yesterdayRank = yesterdayMap.get(key);

        let trend = "new";
        let trendChange = 0;

        if (yesterdayRank !== undefined) {
          trendChange = yesterdayRank - entry.rank;
          if (trendChange > 0) {
            trend = "up";
          } else if (trendChange < 0) {
            trend = "down";
          } else {
            trend = "stable";
          }
        }

        await supabaseClient
          .from("chart_entries")
          .update({ trend, trend_change: trendChange })
          .eq("song_id", entry.song_id)
          .eq("chart_type", entry.chart_type)
          .eq("chart_date", chartDate)
          .eq("country", entry.country || "all");
      }

      console.log("Updated trends for chart entries");
    }

    // =========================================================================
    // STEP 10: Update weeks_on_chart
    // =========================================================================
    const { data: allHistoricalEntries } = await supabaseClient
      .from("chart_entries")
      .select("song_id, chart_type, chart_date, country")
      .order("chart_date", { ascending: true });

    if (allHistoricalEntries) {
      const weeksMap = new Map<string, number>();
      for (const entry of allHistoricalEntries) {
        const key = `${entry.song_id}:${entry.chart_type}:${entry.country || 'all'}`;
        const current = weeksMap.get(key) || 0;
        weeksMap.set(key, current + 1);
      }

      // Update weeks for today's entries
      for (const entry of chartEntries) {
        const key = `${entry.song_id}:${entry.chart_type}:${entry.country || 'all'}`;
        const weeks = weeksMap.get(key) || 1;

        await supabaseClient
          .from("chart_entries")
          .update({ weeks_on_chart: Math.ceil(weeks / 7) })
          .eq("song_id", entry.song_id)
          .eq("chart_type", entry.chart_type)
          .eq("chart_date", chartDate)
          .eq("country", entry.country || "all");
      }

      console.log("Updated weeks_on_chart for entries");
    }

    await completeJobRun({
      runId,
      supabaseClient,
      result: {
        chartsUpdated,
        chartDate,
        regionsProcessed: uniqueRegions.size,
      },
      duration: Date.now() - startedAt,
    });

    return new Response(
      JSON.stringify({
        success: true,
        chartsUpdated,
        chartDate,
        regionsProcessed: uniqueRegions.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating music charts:", error);

    if (runId) {
      await failJobRun({
        runId,
        supabaseClient,
        errorMessage: getErrorMessage(error),
        duration: Date.now() - startedAt,
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
