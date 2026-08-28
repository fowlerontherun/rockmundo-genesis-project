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

class PRActivityError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "PRActivityError";
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabaseClient = createClient(
    supabaseUrl,
    serviceRoleKey,
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
      throw new PRActivityError("offerId is required", 400, "missing_offer_id");
    }

    const { offerId, action = 'accept' } = payload;

    if (!['accept', 'decline', 'complete'].includes(action)) {
      throw new PRActivityError(`Unknown action: ${action}`, 400, "invalid_action");
    }

    const authorization = req.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const isServiceInvocation = token.length > 0 && token === serviceRoleKey;
    let callerUserId: string | null = null;

    if (!isServiceInvocation) {
      if (!token) {
        throw new PRActivityError("You must be signed in to manage PR offers", 401, "unauthorized");
      }

      const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
      if (authError || !authData.user) {
        throw new PRActivityError("Your session is no longer valid. Please sign in again.", 401, "unauthorized");
      }
      callerUserId = authData.user.id;
    }

    // Fetch the offer
    const { data: offer, error: offerError } = await supabaseClient
      .from('pr_media_offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      throw new PRActivityError("This PR offer could not be found", 404, "offer_not_found");
    }

    let leaderProfile: { id: string; user_id: string } | null = null;

    if (action !== 'complete') {
      // PR offers belong to a band, so always resolve the character through the
      // band's current leader. One account can own several character profiles;
      // looking up profiles by user_id with .single() fails for those accounts.
      const { data: band, error: bandError } = await supabaseClient
        .from('bands')
        .select('leader_id')
        .eq('id', offer.band_id)
        .single();

      if (bandError || !band?.leader_id) {
        throw new PRActivityError("The band's leader could not be resolved", 422, "band_leader_not_found");
      }

      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('id, user_id')
        .eq('id', band.leader_id)
        .single();

      if (profileError || !profile?.user_id) {
        throw new PRActivityError("The band leader's character profile could not be found", 422, "leader_profile_not_found");
      }

      leaderProfile = profile;

      if (!isServiceInvocation && callerUserId !== leaderProfile.user_id) {
        throw new PRActivityError("Only the current band leader can manage this PR offer", 403, "forbidden");
      }
    } else if (!isServiceInvocation) {
      throw new PRActivityError("Only the scheduled PR worker can complete an appearance", 403, "forbidden");
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

      return jsonResponse({ success: true, action: 'declined' });
    }

    if (action === 'accept') {
      if (!leaderProfile) {
        throw new PRActivityError("The band leader's character profile could not be found", 422, "leader_profile_not_found");
      }

      const scheduledUserId = leaderProfile.user_id;

      // Determine duration (film = 7 days, others = 1 hour)
      const isFilm = offer.media_type === 'film';
      const durationMinutes = isFilm ? 7 * 24 * 60 : 60;

      // Create scheduled activity times
      const startTime = new Date(`${offer.proposed_date}T10:00:00Z`);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // Check for scheduling conflicts before accepting
      const { data: hasConflict } = await supabaseClient.rpc('check_scheduling_conflict', {
        p_user_id: scheduledUserId,
        p_start: startTime.toISOString(),
        p_end: endTime.toISOString(),
        p_exclude_id: null,
      });

      if (hasConflict) {
        // Get conflicting activity details for error message
        const { data: conflict } = await supabaseClient
          .from('player_scheduled_activities')
          .select('title')
          .eq('user_id', scheduledUserId)
          .in('status', ['scheduled', 'in_progress'])
          .lte('scheduled_start', endTime.toISOString())
          .gte('scheduled_end', startTime.toISOString())
          .limit(1)
          .maybeSingle();

        throw new PRActivityError(
          `You have "${conflict?.title || 'another activity'}" scheduled at this time. Please decline or reschedule.`,
          400,
          "scheduling_conflict",
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
          user_id: scheduledUserId,
          profile_id: leaderProfile.id,
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
        await supabaseClient
          .from('pr_media_offers')
          .update({ status: 'pending', accepted_at: null })
          .eq('id', offerId)
          .eq('status', 'accepted');
        throw new Error(`Failed to schedule the PR appearance: ${activityError.message}`);
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

      return jsonResponse({ success: true, action: 'accepted', scheduledFor: offer.proposed_date });
    }

    if (action === 'complete') {
      // Complete the PR activity and apply rewards
      const bandId = offer.band_id;
      const fameBoost = offer.fame_boost || 0;
      const fanBoost = offer.fan_boost || 0;
      const compensation = offer.compensation || 0;
      const outletName = offer.outlet_name || offer.show_name || `${offer.media_type?.toUpperCase() || 'Media'} Outlet`;
      const cooldownDays = offer.cooldown_days || 30;

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

          // Create cooldown record for this outlet
          if (offer.media_outlet_id && cooldownDays > 0) {
            const cooldownExpiresAt = new Date();
            cooldownExpiresAt.setDate(cooldownExpiresAt.getDate() + cooldownDays);

            await supabaseClient
              .from('band_media_cooldowns')
              .upsert({
                band_id: bandId,
                media_type: offer.media_type,
                outlet_id: offer.media_outlet_id,
                show_id: offer.show_id || null,
                last_appearance_at: new Date().toISOString(),
                cooldown_expires_at: cooldownExpiresAt.toISOString(),
              }, {
                onConflict: 'band_id,media_type,outlet_id,show_id',
              });
          }
        }
      }

      // Create media appearance record
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

      // === FAN SENTIMENT + MEDIA BOOST (v1.0.945) ===
      // PR appearances boost fan engagement and media attention
      try {
        const mediaTypeToEvent: Record<string, { sentiment: number; intensity: number; fatigue: number }> = {
          tv: { sentiment: 4, intensity: 18, fatigue: 12 },
          radio: { sentiment: 3, intensity: 10, fatigue: 8 },
          podcast: { sentiment: 3, intensity: 10, fatigue: 8 },
          magazine: { sentiment: 2, intensity: 8, fatigue: 6 },
          newspaper: { sentiment: 2, intensity: 8, fatigue: 6 },
          online: { sentiment: 2, intensity: 6, fatigue: 4 },
        };
        const boosts = mediaTypeToEvent[offer.media_type] ?? { sentiment: 2, intensity: 6, fatigue: 4 };

        const { data: bandData } = await supabaseClient
          .from('bands')
          .select('fan_sentiment_score, media_intensity, media_fatigue, morale, reputation_score')
          .eq('id', bandId)
          .single();

        if (bandData) {
          const curSentiment = (bandData as any).fan_sentiment_score ?? 0;
          const curIntensity = (bandData as any).media_intensity ?? 0;
          const curFatigue = (bandData as any).media_fatigue ?? 0;
          const curMorale = (bandData as any).morale ?? 50;
          const curRep = (bandData as any).reputation_score ?? 0;
          const fatigueReduction = curFatigue > 60 ? 0.5 : curFatigue > 30 ? 0.75 : 1.0;

          // === PR APPEARANCE → REPUTATION & MORALE (v1.0.964) ===
          const prRepBoost: Record<string, number> = { tv: 5, radio: 3, podcast: 3, magazine: 4, newspaper: 4, online: 2, film: 6 };
          const prMoraleBoost: Record<string, number> = { tv: 4, radio: 2, podcast: 2, magazine: 3, newspaper: 2, online: 1, film: 5 };
          const repBoost = prRepBoost[offer.media_type] ?? 2;
          const moraleBoost = prMoraleBoost[offer.media_type] ?? 1;

          const newSentiment = Math.min(100, curSentiment + boosts.sentiment);
          const newIntensity = Math.min(100, curIntensity + Math.round(boosts.intensity * fatigueReduction));
          const newRep = Math.min(100, curRep + repBoost);
          const newMorale = Math.min(100, curMorale + moraleBoost);
          await supabaseClient.from('bands').update({
            fan_sentiment_score: newSentiment,
            media_intensity: newIntensity,
            media_fatigue: Math.min(100, curFatigue + boosts.fatigue),
            reputation_score: newRep,
            morale: newMorale,
          } as any).eq('id', bandId);

          // Health event logs (v1.0.998)
          try {
            await supabaseClient.from('band_health_events').insert([
              { band_id: bandId, event_type: 'sentiment', delta: boosts.sentiment, new_value: newSentiment, source: 'pr_activity', description: `${offer.media_type.toUpperCase()} appearance on ${outletName}` },
              { band_id: bandId, event_type: 'reputation', delta: repBoost, new_value: newRep, source: 'pr_activity', description: `${offer.media_type.toUpperCase()} PR boosted reputation` },
              { band_id: bandId, event_type: 'morale', delta: moraleBoost, new_value: newMorale, source: 'pr_activity', description: `${offer.media_type.toUpperCase()} appearance morale boost` },
            ]);
          } catch (_) {}

          await supabaseClient.from('band_sentiment_events').insert({
            band_id: bandId,
            event_type: 'pr_appearance',
            sentiment_change: boosts.sentiment,
            media_intensity_change: Math.round(boosts.intensity * fatigueReduction),
            media_fatigue_change: boosts.fatigue,
            sentiment_after: newSentiment,
            source: 'process-pr-activity',
            description: `${offer.media_type.toUpperCase()} appearance boosted reputation`,
          });

          console.log(`[process-pr-activity] Band ${bandId}: sentiment +${boosts.sentiment}, media +${boosts.intensity} (${offer.media_type})`);
        }
      } catch (sentErr) {
        console.error('[process-pr-activity] Error applying sentiment/media boost:', sentErr);
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
          rewards: { fameBoost, fanBoost, compensation },
          cooldownDays,
        },
      });

      return jsonResponse({
        success: true,
        action: 'completed',
        rewards: { fameBoost, fanBoost, compensation },
      });
    }
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
    const status = error instanceof PRActivityError ? error.status : 500;
    const code = error instanceof PRActivityError ? error.code : "internal_error";
    const message = getErrorMessage(error);
    return jsonResponse({ success: false, error: code, message }, status);
  }
});
