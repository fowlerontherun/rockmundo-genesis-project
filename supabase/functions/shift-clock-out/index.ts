import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
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
        const { data: shift, error: shiftFetchError } = await supabaseClient
          .from('shift_history')
          .select('*, player_employment(*)')
          .eq('id', shiftId)
          .single();

        if (shiftFetchError || !shift) {
          throw shiftFetchError ?? new Error('Shift not found');
        }

        const { error: updateShiftError } = await supabaseClient
          .from('shift_history')
          .update({
            clock_out_time: nowIso,
            status: 'completed',
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
        const updatedFame = Math.max(0, (profile?.fame || 0) + (shift.fame_impact || 0));

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
            metadata: { job_id: shift.job_id, shift_id: shiftId },
          });

        if (ledgerError) {
          throw ledgerError;
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

        console.log(
          `Clocked out shift ${shiftId}, awarded ${shift.earnings} cash and ${shift.xp_earned} XP`
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
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        errors: errorCount,
        totalEarnings,
        totalXpAwarded,
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
      },
    });

    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
