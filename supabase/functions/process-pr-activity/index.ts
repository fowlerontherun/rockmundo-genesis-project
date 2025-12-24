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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ 
    triggeredBy?: string; 
    requestId?: string | null;
    offerId?: string;
    action?: 'accept' | 'decline' | 'complete';
  }>(req);
  
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let runId: string | null = null;
  const startedAt = Date.now();

  try {
    runId = await startJobRun({
      jobName: "process-pr-activity",
      functionName: "process-pr-activity",
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    if (!payload?.offerId) {
      throw new Error("offerId is required");
    }

    const { offerId, action = 'accept' } = payload;

    // Fetch the offer
    const { data: offer, error: offerError } = await supabaseClient
      .from('pr_media_offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      throw new Error(`Offer not found: ${offerError?.message || 'Unknown error'}`);
    }

    if (action === 'decline') {
      // Simply mark as declined
      await supabaseClient
        .from('pr_media_offers')
        .update({ status: 'declined' })
        .eq('id', offerId);

      await completeJobRun({
        jobName: "process-pr-activity",
        runId,
        supabaseClient,
        durationMs: Date.now() - startedAt,
        processedCount: 1,
        errorCount: 0,
        resultSummary: { action: 'declined', offerId },
      });

      return new Response(
        JSON.stringify({ success: true, action: 'declined' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (action === 'accept') {
      // Get user's profile_id first
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('user_id', offer.user_id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Determine duration (film = 7 days, others = 1 hour)
      const isFilm = offer.media_type === 'film';
      const durationMinutes = isFilm ? 7 * 24 * 60 : 60;

      // Create scheduled activity times
      const startTime = new Date(`${offer.proposed_date}T10:00:00Z`);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // Check for scheduling conflicts before accepting
      const { data: hasConflict } = await supabaseClient.rpc('check_scheduling_conflict', {
        p_user_id: offer.user_id,
        p_start: startTime.toISOString(),
        p_end: endTime.toISOString(),
        p_exclude_id: null,
      });

      if (hasConflict) {
        // Get conflicting activity details for error message
        const { data: conflict } = await supabaseClient
          .from('player_scheduled_activities')
          .select('title')
          .eq('user_id', offer.user_id)
          .in('status', ['scheduled', 'in_progress'])
          .lte('scheduled_start', endTime.toISOString())
          .gte('scheduled_end', startTime.toISOString())
          .limit(1)
          .single();

        throw new Error(
          `Cannot accept PR offer: You have "${conflict?.title || 'another activity'}" scheduled at this time. Please decline or reschedule.`
        );
      }

      // Mark as accepted
      await supabaseClient
        .from('pr_media_offers')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', offerId);

      // Create scheduled activity
      const { error: activityError } = await supabaseClient
        .from('player_scheduled_activities')
        .insert({
          user_id: offer.user_id,
          profile_id: profile.id,
          activity_type: isFilm ? 'film_production' : 'pr_appearance',
          title: `PR: ${offer.media_type.toUpperCase()} Appearance`,
          scheduled_start: startTime.toISOString(),
          scheduled_end: endTime.toISOString(),
          status: 'scheduled',
          metadata: {
            offer_id: offerId,
            media_type: offer.media_type,
            compensation: offer.compensation,
            fame_boost: offer.fame_boost,
            fan_boost: offer.fan_boost,
            band_id: offer.band_id,
          },
        });

      if (activityError) {
        console.error('Failed to create scheduled activity:', activityError);
      }

      await completeJobRun({
        jobName: "process-pr-activity",
        runId,
        supabaseClient,
        durationMs: Date.now() - startedAt,
        processedCount: 1,
        errorCount: 0,
        resultSummary: { action: 'accepted', offerId, scheduledFor: offer.proposed_date },
      });

      return new Response(
        JSON.stringify({ success: true, action: 'accepted', scheduledFor: offer.proposed_date }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (action === 'complete') {
      // Complete the PR activity and apply rewards
      const bandId = offer.band_id;
      const fameBoost = offer.fame_boost || 0;
      const fanBoost = offer.fan_boost || 0;
      const compensation = offer.compensation || 0;
      const outletName = offer.outlet_name || offer.show_name || `${offer.media_type?.toUpperCase() || 'Media'} Outlet`;

      // Update band fame and fans
      if (bandId) {
        const { data: band } = await supabaseClient
          .from('bands')
          .select('fame, total_fans, band_balance')
          .eq('id', bandId)
          .single();

        if (band) {
          await supabaseClient
            .from('bands')
            .update({
              fame: (band.fame || 0) + fameBoost,
              total_fans: (band.total_fans || 0) + fanBoost,
              band_balance: (band.band_balance || 0) + compensation,
            })
            .eq('id', bandId);

          // Record fame event
          await supabaseClient
            .from('band_fame_events')
            .insert({
              band_id: bandId,
              event_type: 'pr_appearance',
              fame_gained: fameBoost,
              event_data: {
                media_type: offer.media_type,
                offer_id: offerId,
                compensation,
                fan_boost: fanBoost,
                outlet_name: outletName,
              },
            });

          // Record earnings
          await supabaseClient
            .from('band_earnings')
            .insert({
              band_id: bandId,
              amount: compensation,
              source: 'pr_appearance',
              description: `${offer.media_type?.toUpperCase() || 'PR'} appearance on ${outletName}`,
              metadata: { offer_id: offerId, media_type: offer.media_type },
            });
        }
      }

      // Create media appearance record - using correct schema columns
      const { error: appearanceError } = await supabaseClient
        .from('media_appearances')
        .insert({
          band_id: bandId,
          media_type: offer.media_type,
          program_name: outletName,
          network: offer.show_name || outletName,
          air_date: offer.proposed_date,
          audience_reach: fanBoost * 100, // Multiply for realistic reach numbers
          sentiment: 'positive',
          highlight: `Successful ${offer.media_type} appearance`,
        });

      if (appearanceError) {
        console.error('Failed to create media appearance:', appearanceError);
      }

      // Mark offer as completed
      await supabaseClient
        .from('pr_media_offers')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', offerId);

      await completeJobRun({
        jobName: "process-pr-activity",
        runId,
        supabaseClient,
        durationMs: Date.now() - startedAt,
        processedCount: 1,
        errorCount: 0,
        resultSummary: { 
          action: 'completed', 
          offerId, 
          rewards: { fameBoost, fanBoost, compensation } 
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'completed',
          rewards: { fameBoost, fanBoost, compensation }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    await failJobRun({
      jobName: "process-pr-activity",
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { offerId: payload?.offerId, action: payload?.action },
    });

    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
