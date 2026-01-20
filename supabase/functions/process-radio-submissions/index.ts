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
  let processed = 0;
  let accepted = 0;
  let rejected = 0;

  try {
    runId = await startJobRun({
      jobName: "process-radio-submissions",
      functionName: "process-radio-submissions",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    // Get pending submissions older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: pendingSubmissions, error: fetchError } = await supabaseClient
      .from("radio_submissions")
      .select(`
        id,
        song_id,
        station_id,
        band_id,
        user_id,
        songs(id, title, genre, quality_score, hype),
        radio_stations(id, name, quality_level, accepted_genres, listener_base, country, min_fame_required)
      `)
      .eq("status", "pending")
      .lt("submitted_at", oneHourAgo)
      .limit(50);

    if (fetchError) throw fetchError;

    console.log(`Processing ${pendingSubmissions?.length || 0} pending submissions`);

    for (const submission of pendingSubmissions || []) {
      const song = submission.songs as any;
      const station = submission.radio_stations as any;
      
      if (!song || !station) {
        // Reject - missing data
        await supabaseClient
          .from("radio_submissions")
          .update({
            status: "rejected",
            rejection_reason: "Missing song or station data",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", submission.id);
        rejected++;
        processed++;
        continue;
      }

      // Check country fame requirement
      const stationCountry = station.country;
      const minFameRequired = station.min_fame_required || 0;
      let bandCountryFame = 0;
      
      if (minFameRequired > 0 && submission.band_id && stationCountry) {
        const { data: fameData } = await supabaseClient.rpc("get_band_country_fame", {
          p_band_id: submission.band_id,
          p_country: stationCountry,
        });
        bandCountryFame = fameData || 0;
        
        if (bandCountryFame < minFameRequired) {
          // Reject - insufficient fame in country
          await supabaseClient
            .from("radio_submissions")
            .update({
              status: "rejected",
              rejection_reason: `Insufficient fame in ${stationCountry}. Required: ${minFameRequired}, Your fame: ${bandCountryFame}`,
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", submission.id);
          rejected++;
          processed++;
          continue;
        }
      }

      // Check quality threshold (station quality * 0.6 = minimum song quality)
      const minQuality = Math.max(20, (station.quality_level || 50) * 0.6);
      const songQuality = song.quality_score || 0;
      
      // Check genre match - case insensitive comparison
      const acceptedGenres = (station.accepted_genres || []).map((g: string) => g.toLowerCase());
      const songGenre = (song.genre || "").toLowerCase();
      const genreMatch = acceptedGenres.length === 0 || acceptedGenres.includes(songGenre);

      // Calculate acceptance probability
      let acceptProbability = 0.3; // Base 30%
      
      if (songQuality >= minQuality) {
        acceptProbability += 0.3; // +30% for meeting quality
      }
      if (genreMatch) {
        acceptProbability += 0.2; // +20% for genre match
      }
      if (song.hype >= 100) {
        acceptProbability += 0.2; // +20% for hype
      }
      // Bonus for having fame in the country
      if (bandCountryFame >= 500) {
        acceptProbability += 0.1; // +10% for established presence
      }

      const isAccepted = Math.random() < acceptProbability;

      if (isAccepted) {
        // Accept submission
        await supabaseClient
          .from("radio_submissions")
          .update({
            status: "accepted",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", submission.id);

        // Find or create an active show for this station
        const { data: activeShow } = await supabaseClient
          .from("radio_shows")
          .select("id")
          .eq("station_id", submission.station_id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (activeShow) {
          // Add to playlist - check if not already exists
          const { data: existingPlaylist } = await supabaseClient
            .from("radio_playlists")
            .select("id")
            .eq("show_id", activeShow.id)
            .eq("song_id", submission.song_id)
            .maybeSingle();
          
          if (!existingPlaylist) {
            // Calculate week start date (Monday of current week)
            const now = new Date();
            const dayOfWeek = now.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() + mondayOffset);
            const weekStartDate = weekStart.toISOString().split('T')[0];
            
            await supabaseClient
              .from("radio_playlists")
              .insert({
                show_id: activeShow.id,
                song_id: submission.song_id,
                week_start_date: weekStartDate,
                is_active: true,
              });
          }
        }

        accepted++;
      } else {
        // Reject with reason
        let reason = "Song did not meet station criteria.";
        if (songQuality < minQuality) {
          reason = `Song quality (${songQuality}) is below station's minimum (${Math.round(minQuality)}).`;
        } else if (!genreMatch) {
          reason = `Song genre "${songGenre}" is not accepted by this station.`;
        }

        await supabaseClient
          .from("radio_submissions")
          .update({
            status: "rejected",
            rejection_reason: reason,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", submission.id);

        rejected++;
      }
      
      processed++;
    }

    console.log(`Processed: ${processed}, Accepted: ${accepted}, Rejected: ${rejected}`);

    await completeJobRun({
      jobName: "process-radio-submissions",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount: processed,
      resultSummary: { processed, accepted, rejected },
    });

    return new Response(
      JSON.stringify({ success: true, processed, accepted, rejected }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await failJobRun({
      jobName: "process-radio-submissions",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { processed, accepted, rejected },
    });

    console.error("Error processing submissions:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
