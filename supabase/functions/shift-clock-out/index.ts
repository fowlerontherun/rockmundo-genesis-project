import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-triggered-by',
};

/**
 * Calculate dynamic fame impact based on band popularity and job prestige tier
 * Famous artists working low-prestige jobs lose more fame
 */
async function calculateDynamicFameImpact(
  profileId: string,
  baseFameImpact: number,
  famePenaltyTier: string | null,
  supabaseClient: SupabaseClient
): Promise<{ fameImpact: number; bandName: string | null }> {
  // If no penalty tier or positive fame impact, return base value
  if (!famePenaltyTier || famePenaltyTier === 'none' || baseFameImpact >= 0) {
    return { fameImpact: baseFameImpact, bandName: null };
  }

  // Get player's band info
  const { data: bandMember } = await supabaseClient
    .from('band_members')
    .select('band_id, role, bands(name, popularity, weekly_fans, fame)')
    .eq('user_id', profileId)
    .eq('member_status', 'active')
    .limit(1)
    .single();

  if (!bandMember?.bands) {
    return { fameImpact: baseFameImpact, bandName: null };
  }

  const band = bandMember.bands as { name: string; popularity: number; weekly_fans: number; fame: number };
  const bandPopularity = band.popularity || band.fame || 0;
  const isLeader = bandMember.role === 'leader';

  // Fame penalty multiplier based on popularity tiers
  let multiplier = 1;
  if (bandPopularity >= 100000) {
    multiplier = 5; // Major star - maximum shame
  } else if (bandPopularity >= 50000) {
    multiplier = 4; // Famous - very embarrassing
  } else if (bandPopularity >= 10000) {
    multiplier = 3; // Well-known - quite embarrassing
  } else if (bandPopularity >= 1000) {
    multiplier = 2; // Known locally - somewhat embarrassing
  } else {
    multiplier = 1; // Unknown - no shame multiplier
  }

  // Extra penalty based on tier
  let tierMultiplier = 1;
  switch (famePenaltyTier) {
    case 'severe':
      tierMultiplier = 1.5;
      break;
    case 'moderate':
      tierMultiplier = 1.25;
      break;
    case 'minor':
      tierMultiplier = 1.0;
      break;
    default:
      tierMultiplier = 1.0;
  }

  // Extra penalty for band leaders doing menial jobs
  const leaderPenalty = isLeader ? 1.5 : 1;

  const finalFameImpact = Math.floor(baseFameImpact * multiplier * tierMultiplier * leaderPenalty);

  console.log(`[shift-clock-out] Dynamic fame calculation: base=${baseFameImpact}, popularity=${bandPopularity}, tier=${famePenaltyTier}, isLeader=${isLeader}, final=${finalFameImpact}`);

  return { fameImpact: finalFameImpact, bandName: band.name };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined;

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  let totalXpAwarded = 0;
  let totalEarnings = 0;
  let totalFameChange = 0;

  try {
    runId = await startJobRun({
      jobName: 'shift-clock-out',
      functionName: 'shift-clock-out',
      supabaseClient,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const nowIso = new Date().toISOString();

    const { data: activeShifts, error: shiftsError } = await supabaseClient
      .from('profile_activity_statuses')
      .select('*')
      .eq('activity_type', 'work_shift')
      .eq('status', 'active')
      .lt('ends_at', nowIso);

    if (shiftsError) {
      throw shiftsError;
    }

    console.log(`Found ${activeShifts?.length || 0} shifts to clock out`);

    for (const activity of activeShifts || []) {
      const shiftId = activity.metadata?.shift_history_id;
      if (!shiftId) continue;

      try {
        // Fetch shift with job details including new columns
        const { data: shift, error: shiftFetchError } = await supabaseClient
          .from('shift_history')
          .select('*, player_employment(*)')
          .eq('id', shiftId)
          .single();

        if (shiftFetchError || !shift) {
          throw shiftFetchError ?? new Error('Shift not found');
        }

        // Fetch job details for fame penalty tier
        const { data: job } = await supabaseClient
          .from('jobs')
          .select('title, category, fame_penalty_tier, base_fame_impact')
          .eq('id', shift.job_id)
          .single();

        // Calculate dynamic fame impact
        const { fameImpact: dynamicFameImpact, bandName } = await calculateDynamicFameImpact(
          activity.profile_id,
          job?.base_fame_impact ?? shift.fame_impact ?? 0,
          job?.fame_penalty_tier ?? null,
          supabaseClient
        );

        const { error: updateShiftError } = await supabaseClient
          .from('shift_history')
          .update({
            clock_out_time: nowIso,
            status: 'completed',
            fame_impact: dynamicFameImpact, // Store actual fame impact
          })
          .eq('id', shiftId);

        if (updateShiftError) {
          throw updateShiftError;
        }

        const { error: employmentError } = await supabaseClient
          .from('player_employment')
          .update({
            shifts_completed: (shift.player_employment.shifts_completed || 0) + 1,
            total_earnings: (shift.player_employment.total_earnings || 0) + (shift.earnings || 0),
            last_shift_at: nowIso,
          })
          .eq('id', shift.employment_id);

        if (employmentError) {
          throw employmentError;
        }

        const { data: profile, error: profileFetchError } = await supabaseClient
          .from('profiles')
          .select('cash, health, fame')
          .eq('id', shift.profile_id)
          .single();

        if (profileFetchError) {
          throw profileFetchError;
        }

        const updatedCash = (profile?.cash || 0) + (shift.earnings || 0);
        const updatedHealth = Math.max(
          0,
          Math.min(100, (profile?.health || 100) + (shift.health_impact || 0))
        );
        const updatedFame = Math.max(0, (profile?.fame || 0) + dynamicFameImpact);

        const { error: profileUpdateError } = await supabaseClient
          .from('profiles')
          .update({
            cash: updatedCash,
            health: updatedHealth,
            fame: updatedFame,
          })
          .eq('id', shift.profile_id);

        if (profileUpdateError) {
          throw profileUpdateError;
        }

        const { error: ledgerError } = await supabaseClient
          .from('experience_ledger')
          .insert({
            user_id: activity.profile_id,
            profile_id: shift.profile_id,
            activity_type: 'work_shift',
            xp_amount: shift.xp_earned,
            metadata: { 
              job_id: shift.job_id, 
              shift_id: shiftId,
              fame_change: dynamicFameImpact,
              job_title: job?.title,
              band_name: bandName,
            },
          });

        if (ledgerError) {
          throw ledgerError;
        }

        // Update scheduled activity to completed (if exists)
        const { error: scheduleUpdateError } = await supabaseClient
          .from('player_scheduled_activities')
          .update({
            status: 'completed',
            completed_at: nowIso,
          })
          .eq('linked_job_shift_id', shiftId);

        if (scheduleUpdateError) {
          console.warn(`Warning updating scheduled activity: ${scheduleUpdateError.message}`);
        }

        const { error: activityDeleteError } = await supabaseClient
          .from('profile_activity_statuses')
          .delete()
          .eq('id', activity.id);

        if (activityDeleteError) {
          throw activityDeleteError;
        }

        processedCount += 1;
        totalEarnings += shift.earnings || 0;
        totalXpAwarded += shift.xp_earned || 0;
        totalFameChange += dynamicFameImpact;

        console.log(
          `Clocked out shift ${shiftId}, awarded ${shift.earnings} cash, ${shift.xp_earned} XP, fame change: ${dynamicFameImpact}`
        );
      } catch (shiftError) {
        errorCount += 1;
        console.error(`Error processing shift ${shiftId}:`, shiftError);
      }
    }

    await completeJobRun({
      jobName: 'shift-clock-out',
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      processedCount,
      errorCount,
      resultSummary: {
        processedCount,
        errorCount,
        totalEarnings,
        totalXpAwarded,
        totalFameChange,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        totalEarnings,
        totalXpAwarded,
        totalFameChange,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await failJobRun({
      jobName: 'shift-clock-out',
      runId,
      supabaseClient,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        processedCount,
        errorCount,
        totalEarnings,
        totalXpAwarded,
        totalFameChange,
      },
    });

    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
