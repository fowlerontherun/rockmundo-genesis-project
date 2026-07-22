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

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Window (minutes) after a shift's scheduled start_time during which we'll still auto-clock-in.
const CLOCK_IN_WINDOW_MINUTES = 30;

function parseHHMM(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let runId: string | null = null;
  const startedAt = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    runId = await startJobRun({
      jobName: 'shift-clock-in',
      functionName: 'shift-clock-in',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const now = new Date();
    const nowIso = now.toISOString();
    const todayName = DAY_NAMES[now.getUTCDay()];
    const yesterdayName = DAY_NAMES[(now.getUTCDay() + 6) % 7];
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    // Fetch all auto-attend employments with job + profile snapshot
    const { data: rows, error: fetchError } = await supabase
      .from('player_employment')
      .select(`
        id, profile_id, job_id, status, auto_clock_in,
        jobs:job_id (
          id, title, start_time, end_time, work_days, hourly_wage,
          city_id, health_impact_per_shift, fame_impact_per_shift, energy_cost_per_shift
        ),
        profiles:profile_id ( id, current_city_id, health, energy, cash )
      `)
      .eq('auto_clock_in', true)
      .eq('status', 'employed');

    if (fetchError) throw fetchError;

    for (const row of rows || []) {
      const job = (row as any).jobs;
      const profile = (row as any).profiles;
      if (!job || !profile) { skippedCount++; continue; }

      try {
        const workDays: string[] = Array.isArray(job.work_days) ? job.work_days : [];
        if (workDays.length === 0) { skippedCount++; continue; }

        const start = parseHHMM(job.start_time);
        const end = parseHHMM(job.end_time);
        const startMin = start.h * 60 + start.m;
        const endMin = end.h * 60 + end.m;
        const overnight = endMin <= startMin;

        // Does *today* start a shift?
        const startsToday = workDays.includes(todayName)
          && nowMinutes >= startMin
          && nowMinutes <= startMin + CLOCK_IN_WINDOW_MINUTES;

        // Overnight shift begun *yesterday* and still within its start window
        // (rare: only if this cron missed the last window; skipped to avoid duplicates).
        if (!startsToday) { skippedCount++; continue; }

        // City requirement
        if (job.city_id && profile.current_city_id && job.city_id !== profile.current_city_id) {
          skippedCount++;
          continue;
        }

        // Already clocked in / any active work_shift?
        const { data: active } = await supabase
          .from('profile_activity_statuses')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('activity_type', 'work_shift')
          .eq('status', 'active')
          .maybeSingle();
        if (active) { skippedCount++; continue; }

        // Already have a shift_history row today for this employment?
        const today = now.toISOString().slice(0, 10);
        const { data: existing } = await supabase
          .from('shift_history')
          .select('id')
          .eq('employment_id', row.id)
          .eq('shift_date', today)
          .maybeSingle();
        if (existing) { skippedCount++; continue; }

        // Build shift
        const hours = overnight
          ? ((24 * 60 - startMin) + endMin) / 60
          : (endMin - startMin) / 60;
        const earnings = Math.round((job.hourly_wage || 0) * hours);

        const endsAt = new Date(now);
        endsAt.setUTCHours(end.h, end.m, 0, 0);
        if (overnight) endsAt.setUTCDate(endsAt.getUTCDate() + 1);

        const { data: shift, error: shiftErr } = await supabase
          .from('shift_history')
          .insert({
            employment_id: row.id,
            profile_id: profile.id,
            job_id: job.id,
            shift_date: today,
            clock_in_time: nowIso,
            earnings,
            health_impact: job.health_impact_per_shift ?? 0,
            fame_impact: job.fame_impact_per_shift ?? 0,
            xp_earned: Math.round(earnings / 10),
            status: 'in_progress',
          })
          .select()
          .single();
        if (shiftErr) throw shiftErr;

        const { error: statusErr } = await supabase
          .from('profile_activity_statuses')
          .insert({
            profile_id: profile.id,
            activity_type: 'work_shift',
            status: 'active',
            started_at: nowIso,
            ends_at: endsAt.toISOString(),
            metadata: {
              job_id: job.id,
              shift_history_id: shift.id,
              earnings_pending: earnings,
              auto_clock_in: true,
            },
          });
        if (statusErr) throw statusErr;

        // Apply energy/health drain (mirror manual clockIn)
        const newHealth = Math.max(0, Math.min(100, (profile.health ?? 100) + (job.health_impact_per_shift || 0)));
        const newEnergy = Math.max(0, (profile.energy ?? 100) - (job.energy_cost_per_shift || 0));
        await supabase.from('profiles').update({ health: newHealth, energy: newEnergy }).eq('id', profile.id);

        processedCount++;
        console.log(`[shift-clock-in] Auto-clocked in profile ${profile.id} for "${job.title}" (shift ${shift.id})`);
      } catch (err) {
        errorCount++;
        console.error(`[shift-clock-in] Error on employment ${row.id}:`, err);
      }
    }

    await completeJobRun({
      jobName: 'shift-clock-in',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount,
      errorCount,
      resultSummary: { processedCount, errorCount, skippedCount },
    });

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, errors: errorCount, skipped: skippedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    await failJobRun({
      jobName: 'shift-clock-in',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: { processedCount, errorCount, skippedCount },
    });
    console.error('[shift-clock-in] Fatal:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
