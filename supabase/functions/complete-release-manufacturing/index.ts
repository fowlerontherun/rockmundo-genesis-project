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

  const startTime = Date.now();
  console.log("[complete-release-manufacturing] Starting execution...");

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // First, check how many releases are in manufacturing status
    const { data: manufacturingReleases, error: countError } = await supabaseClient
      .from("releases")
      .select("id, title, manufacturing_complete_at, scheduled_release_date")
      .eq("release_status", "manufacturing");

    if (countError) {
      console.error("[complete-release-manufacturing] Error fetching manufacturing releases:", countError);
    } else {
      console.log(`[complete-release-manufacturing] Found ${manufacturingReleases?.length || 0} releases in manufacturing status`);
      
      // Log details of each release
      manufacturingReleases?.forEach((r) => {
        const isReady = r.manufacturing_complete_at && new Date(r.manufacturing_complete_at) <= new Date();
        const scheduledOk = !r.scheduled_release_date || new Date(r.scheduled_release_date) <= new Date();
        console.log(`[complete-release-manufacturing] Release "${r.title}": manufacturing_complete_at=${r.manufacturing_complete_at}, isReady=${isReady}, scheduledOk=${scheduledOk}`);
      });
    }

    // Call the database function to auto-complete manufacturing
    const { data, error } = await supabaseClient.rpc("auto_complete_manufacturing");

    if (error) {
      console.error("[complete-release-manufacturing] Error completing manufacturing:", error);
      throw error;
    }

    const completedCount = data ?? 0;
    const duration = Date.now() - startTime;
    
    console.log(`[complete-release-manufacturing] Completed ${completedCount} releases in ${duration}ms`);

    // === FAN SENTIMENT BOOST (v1.0.943) ===
    // Apply positive sentiment to bands for each completed release
    if (completedCount > 0 && manufacturingReleases) {
      try {
        // Get the band_ids from the completed releases
        const { data: completedReleases } = await supabaseClient
          .from("releases")
          .select("id, band_id, release_type")
          .eq("release_status", "released")
          .in("id", manufacturingReleases.map(r => r.id));

        for (const release of completedReleases || []) {
          if (!release.band_id) continue;
          const sentimentBoost = release.release_type === 'album' ? 10 : 5; // album_release: +10, single_release: +5
          const mediaBoost = release.release_type === 'album' ? 30 : 15;

          const { data: band } = await supabaseClient
            .from('bands')
            .select('fan_sentiment_score, media_intensity, media_fatigue, reputation_score, morale')
            .eq('id', release.band_id)
            .single();

          if (band) {
            const currentSentiment = (band as any).fan_sentiment_score ?? 0;
            const currentIntensity = (band as any).media_intensity ?? 0;
            const currentFatigue = (band as any).media_fatigue ?? 0;
            const currentRep = (band as any).reputation_score ?? 0;
            const currentMorale = (band as any).morale ?? 50;
            const fatigueReduction = currentFatigue > 60 ? 0.5 : currentFatigue > 30 ? 0.75 : 1.0;
            const newSentiment = Math.min(100, currentSentiment + sentimentBoost);
            const actualMediaBoost = Math.round(mediaBoost * fatigueReduction);
            const fatigueGain = release.release_type === 'album' ? 15 : 8;

            // v1.0.961: Releases boost reputation and morale
            const repBoost = release.release_type === 'album' ? 5 : 2; // Albums improve public image more
            const moraleBoost = release.release_type === 'album' ? 6 : 3; // Band excited about their release
            const newRep = Math.min(100, currentRep + repBoost);
            const newMorale = Math.min(100, currentMorale + moraleBoost);

            await supabaseClient.from('bands').update({
              fan_sentiment_score: newSentiment,
              media_intensity: Math.min(100, currentIntensity + actualMediaBoost),
              media_fatigue: Math.min(100, currentFatigue + fatigueGain),
              reputation_score: newRep,
              morale: newMorale,
            } as any).eq('id', release.band_id);

            await supabaseClient.from('band_sentiment_events').insert({
              band_id: release.band_id,
              event_type: release.release_type === 'album' ? 'album_release' : 'single_release',
              sentiment_change: sentimentBoost,
              media_intensity_change: actualMediaBoost,
              media_fatigue_change: fatigueGain,
              sentiment_after: newSentiment,
              source: 'complete-release-manufacturing',
              description: `${release.release_type === 'album' ? 'Album' : 'Single'} release excited fans and attracted media attention`,
            });

            console.log(`[complete-release-manufacturing] Band ${release.band_id}: sentiment +${sentimentBoost}, media +${mediaBoost} (${release.release_type})`);
          }
        }
      } catch (sentErr) {
        console.error('[complete-release-manufacturing] Error applying sentiment/media boosts:', sentErr);
      }
    }

    // Trigger auto-distribute-streaming to handle streaming platform distribution
    if (completedCount > 0) {
      try {
        console.log('[complete-release-manufacturing] Triggering auto-distribute-streaming...');
        await supabaseClient.functions.invoke('auto-distribute-streaming');
        console.log('[complete-release-manufacturing] Successfully triggered auto-distribute-streaming');
      } catch (distributeError) {
        console.error('[complete-release-manufacturing] Failed to trigger auto-distribute-streaming:', distributeError);
      }
    }

    // Log to cron_job_runs if table exists
    try {
      await supabaseClient.from("cron_job_runs").insert({
        job_name: "complete-release-manufacturing",
        function_name: "complete-release-manufacturing",
        status: "success",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        records_processed: completedCount,
        metadata: { releases_completed: completedCount, duration_ms: duration },
      });
    } catch (logError) {
      console.warn("[complete-release-manufacturing] Could not log to cron_job_runs:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        completed: completedCount,
        duration_ms: duration,
        message: `${completedCount} release(s) transitioned to released status`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[complete-release-manufacturing] Error:", error);
    
    // Log error to cron_job_runs
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      await supabaseClient.from("cron_job_runs").insert({
        job_name: "complete-release-manufacturing",
        function_name: "complete-release-manufacturing",
        status: "error",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        error_message: error.message,
        metadata: { duration_ms: duration },
      });
    } catch (logError) {
      console.warn("[complete-release-manufacturing] Could not log error to cron_job_runs:", logError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
