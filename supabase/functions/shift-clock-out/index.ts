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

  // The only supported caller is the internal pg_cron job. A browser JWT,
  // anon API key, or arbitrary JSON request must not start economy-wide payroll.
  // Validate before parsing untrusted input or starting any job/settlement.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const cronSecret = req.headers.get('x-cron-secret');
  const { data: isAuthorized, error: authError } = await supabaseClient.rpc(
    'verify_internal_cron_secret',
    { p_secret: cronSecret },
  );
  if (authError || isAuthorized !== true) {
    console.warn('[shift-clock-out] Rejected untrusted invocation');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined;

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
        // The database owns the entire once-only transaction: row locking,
        // ownership, tax, wage, fame, XP, band morale and schedule completion.
        // No independent money/reward writes are permitted in this worker.
        const { data: receipt, error: settlementError } = await supabaseClient.rpc(
          'settle_work_shift_atomic',
          { p_activity_id: activity.id, p_shift_id: shiftId },
        );
        if (settlementError) throw settlementError;
        if (!receipt?.settled) {
          console.log(`Skipped previously completed shift ${shiftId}`);
          continue;
        }
        processedCount += 1;
        totalEarnings += Number(receipt.net ?? 0);
        totalXpAwarded += Number(receipt.xp ?? 0);
        totalFameChange += Number(receipt.fame ?? 0);
        console.log(
          `Settled work shift ${shiftId}: gross $${receipt.gross}, tax $${receipt.city_tax}, net $${receipt.net}, XP ${receipt.xp}, fame ${receipt.fame}`,
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
