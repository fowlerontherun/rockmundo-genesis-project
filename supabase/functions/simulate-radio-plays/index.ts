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
  let playsCreated = 0;
  let totalListeners = 0;
  let totalHype = 0;

  try {
    runId = await startJobRun({
      jobName: "simulate-radio-plays",
      functionName: "simulate-radio-plays",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    // Get active playlists with their songs and station country info
    const { data: playlists, error: playlistError } = await supabaseClient
      .from("radio_playlists")
      .select(`
        id,
        song_id,
        show_id,
        radio_shows!inner(
          id,
          station_id,
          show_name,
          is_active,
          radio_stations(id, name, listener_base, quality_level, country)
        ),
        songs(id, title, band_id, user_id, hype, quality_score)
      `)
      .eq("radio_shows.is_active", true)
      .limit(100);

    if (playlistError) throw playlistError;

    console.log(`Found ${playlists?.length || 0} songs in active playlists`);

    // Simulate plays for each song in rotation
    for (const playlist of playlists || []) {
      const show = playlist.radio_shows as any;
      const station = show?.radio_stations;
      const song = playlist.songs as any;
      
      if (!station || !song) continue;

      // Calculate listeners based on station size and time variance
      const hour = new Date().getUTCHours();
      const isPeakHours = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
      const timeMult = isPeakHours ? 1.5 : (hour >= 0 && hour <= 5) ? 0.3 : 1.0;
      
      const baseListeners = station.listener_base || 10000;
      const variance = 0.7 + Math.random() * 0.6; // 70%-130%
      const listeners = Math.round(baseListeners * timeMult * variance * 0.01); // 1% of station audience

      // Get song's vote score to influence hype/fame
      const { data: voteScore } = await supabaseClient
        .rpc('get_song_vote_score', { p_song_id: song.id });
      
      const netVoteScore = voteScore || 0;
      // +2% hype/fame per net upvote (capped at +50%)
      const voteMultiplier = 1 + Math.min(0.5, Math.max(0, netVoteScore * 0.02));

      // Calculate hype and streams boost with vote multiplier
      const qualityMult = (song.quality_score || 50) / 100;
      const hypeGained = Math.round(listeners * 0.05 * qualityMult * voteMultiplier); // 5% of listeners become fans
      const streamsBoost = Math.round(listeners * 0.1); // 10% go stream the song

      // Create play record
      const { error: playError } = await supabaseClient
        .from("radio_plays")
        .insert({
          song_id: playlist.song_id,
          station_id: station.id,
          show_id: show.id,
          playlist_id: playlist.id,
          played_at: new Date().toISOString(),
          listeners,
          hype_gained: hypeGained,
          streams_boost: streamsBoost,
        });

      if (playError) {
        console.error("Error creating play:", playError);
        continue;
      }

      // Update song hype
      await supabaseClient
        .from("songs")
        .update({ hype: (song.hype || 0) + hypeGained })
        .eq("id", song.id);

      // Update band fame if applicable (with vote multiplier)
      if (song.band_id) {
        const { data: band } = await supabaseClient
          .from("bands")
          .select("fame")
          .eq("id", song.band_id)
          .single();

        if (band) {
          const fameGain = Math.round(hypeGained * 0.5 * voteMultiplier);
          const fanGain = Math.round(hypeGained * 0.2);
          
          await supabaseClient
            .from("bands")
            .update({ fame: (band.fame || 0) + fameGain })
            .eq("id", song.band_id);

          // Add regional fame for the station's country
          const stationCountry = station.country;
          if (stationCountry) {
            await supabaseClient.rpc("add_band_country_fame", {
              p_band_id: song.band_id,
              p_country: stationCountry,
              p_fame_amount: fameGain,
              p_fans_amount: fanGain,
            });
          }
        }
      }

      // Update profile fame if applicable
      if (song.user_id) {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("fame, fans")
          .eq("user_id", song.user_id)
          .single();

        if (profile) {
          await supabaseClient
            .from("profiles")
            .update({ 
              fame: (profile.fame || 0) + Math.round(hypeGained * 0.3),
              fans: (profile.fans || 0) + Math.round(hypeGained * 0.1),
            })
            .eq("user_id", song.user_id);
        }
      }

      playsCreated++;
      totalListeners += listeners;
      totalHype += hypeGained;
    }

    console.log(`Created ${playsCreated} plays, ${totalListeners} total listeners, ${totalHype} total hype`);

    await completeJobRun({
      jobName: "simulate-radio-plays",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: playsCreated,
      resultSummary: { playsCreated, totalListeners, totalHype },
    });

    return new Response(
      JSON.stringify({ success: true, playsCreated, totalListeners, totalHype }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await failJobRun({
      jobName: "simulate-radio-plays",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { playsCreated, totalListeners, totalHype },
    });

    console.error("Error simulating plays:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
