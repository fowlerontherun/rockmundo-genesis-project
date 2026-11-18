import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";
import {
  failedCompletionMetadata,
  isCompletionRetryDue,
  requireWorkerSuccess,
} from "../_shared/scheduledCompletionGuards.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-triggered-by',
};

interface ScheduledActivity {
  id: string;
  user_id: string;
  profile_id: string;
  activity_type: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  metadata: any;
  linked_gig_id?: string;
  linked_rehearsal_id?: string;
  linked_recording_id?: string;
  linked_job_shift_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req);
  const triggeredBy = payload?.triggeredBy ?? req.headers.get("x-triggered-by") ?? undefined;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cronSecret = req.headers.get("x-cron-secret");
  const { data: cronAuthorized, error: cronAuthError } = await supabase.rpc(
    "verify_internal_cron_secret",
    { p_secret: cronSecret },
  );
  if (cronAuthError || cronAuthorized !== true) {
    console.warn("[process-scheduled-activities] Rejected unauthorized invocation");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let runId: string | null = null;
  const startedAt = Date.now();

  try {
    runId = await startJobRun({
      jobName: "process-scheduled-activities",
      functionName: "process-scheduled-activities",
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    });

    const now = new Date().toISOString();
    let processedCount = 0;
    let startedCount = 0;
    let completedCount = 0;
    let completionFailures = 0;
    let completionDeferred = 0;
    let completionNeedsReview = 0;
    const scheduledTwaatResult = await publishDueScheduledTwaats(supabase, now, supabaseUrl, supabaseKey);

    const { data: toStart, error: startError } = await supabase
      .from('player_scheduled_activities')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_start', now);
    if (startError) throw startError;

    for (const activity of toStart || []) {
      // An outage must not turn an expired-but-unprocessed booking into a
      // permanent "missed" result. Its canonical worker still has to settle it.
      const { data: started, error: startUpdateError } = await supabase
        .from('player_scheduled_activities')
        .update({ status: 'in_progress', started_at: now })
        .eq('id', activity.id)
        .eq('status', 'scheduled')
        .select('id');
      if (startUpdateError) throw startUpdateError;
      if (started?.length) startedCount++;
    }

    const { data: toComplete, error: completeError } = await supabase
      .from('player_scheduled_activities')
      .select('*')
      .eq('status', 'in_progress')
      .lte('scheduled_end', now);
    if (completeError) throw completeError;

    for (const activity of toComplete || []) {
      if (!isCompletionRetryDue(activity.metadata, new Date(now))) {
        completionDeferred++;
        if (activity.metadata?.completionNeedsReview) completionNeedsReview++;
        continue;
      }
      // Film schedules must be settled entirely in one SQL transaction,
      // including their activity status. No generic status UPDATE may follow.
      if (activity.activity_type === 'film_production') {
        try {
          const contractId = activity.metadata?.contract_id;
          if (!contractId) throw new Error('Film activity is missing its contract');
          const { data: settlement, error: settlementError } = await supabase.rpc(
            'settle_film_contract_atomic',
            { p_activity_id: activity.id, p_contract_id: contractId },
          );
          if (settlementError) throw settlementError;
          if (settlement?.settled === true) {
            completedCount++;
          } else if (settlement?.reason !== 'already_settled' &&
                     settlement?.reason !== 'schedule_not_due' &&
                     settlement?.reason !== 'filming_not_finished') {
            throw new Error(`Film settlement rejected: ${settlement?.reason ?? 'unknown'}`);
          }
        } catch (filmError) {
          console.error(`[process-scheduled-activities] Film settlement failed for ${activity.id}`, filmError);
          completionFailures++;
          const metadata = failedCompletionMetadata(activity.metadata, getErrorMessage(filmError), new Date(now));
          if (metadata.completionNeedsReview) completionNeedsReview++;
          const { error: retryError } = await supabase.from('player_scheduled_activities')
            .update({ metadata }).eq('id', activity.id).eq('status', 'in_progress');
          if (retryError) console.error(`Unable to record film settlement retry for ${activity.id}`, retryError);
        }
        continue;
      }
      // Work-shift payout is owned by the dedicated, secret-authorised cron
      // and its atomic settlement RPC. Do not call that global worker here or
      // mark the scheduled work activity complete before wages actually post.
      // Tour/manual travel completion belongs to the travel lifecycle worker;
      // no generic calendar tick may race its location/state transitions.
      if (activity.activity_type === 'work' || activity.activity_type === 'university' ||
          activity.activity_type === 'travel') continue;
      try {
        await processActivityCompletion(supabase, activity);
        const { data: completed, error: statusError } = await supabase
          .from('player_scheduled_activities')
          .update({ status: 'completed', completed_at: now })
          .eq('id', activity.id)
          .eq('status', 'in_progress')
          .select('id')
          .maybeSingle();
        if (statusError) throw statusError;
        if (completed) completedCount++;
      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error);
        completionFailures++;
        // Keep the activity retryable. Mark persistent failures for an admin
        // rather than claiming the underlying gig, recording or pay completed.
        const metadata = failedCompletionMetadata(activity.metadata, getErrorMessage(error), new Date(now));
        if (metadata.completionNeedsReview) completionNeedsReview++;
        const { error: retryError } = await supabase
          .from('player_scheduled_activities')
          .update({ metadata })
          .eq('id', activity.id)
          .eq('status', 'in_progress');
        if (retryError) console.error(`Unable to record retry for activity ${activity.id}`, retryError);
      }
    }

    processedCount = startedCount + completedCount + scheduledTwaatResult.publishedCount;
    const resultSummary = {
      startedCount,
      completedCount,
      completionFailures,
      completionDeferred,
      completionNeedsReview,
      // A late/outage-delayed booking is retried; never silently mark it missed.
      missedCount: 0,
      publishedTwaatCount: scheduledTwaatResult.publishedCount,
      scheduledOutcomeAttempts: scheduledTwaatResult.outcomeAttempts,
      scheduledOutcomeFailures: scheduledTwaatResult.outcomeFailures,
    };

    await completeJobRun({
      jobName: "process-scheduled-activities",
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount,
      errorCount: completionFailures,
      resultSummary,
    });

    return new Response(JSON.stringify({ success: true, processedCount, ...resultSummary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing scheduled activities:', error);
    await failJobRun({
      jobName: "process-scheduled-activities",
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
    });
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function publishDueScheduledTwaats(
  supabase: any,
  now: string,
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  const { data: dueTwaats, error: dueError } = await supabase
    .from('twaats')
    .select('id, scheduled_for')
    .not('scheduled_for', 'is', null)
    .is('deleted_at', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100);
  if (dueError) throw dueError;

  let publishedCount = 0;
  for (const twaat of dueTwaats || []) {
    if (!twaat.scheduled_for) continue;
    const { data: published, error: publishError } = await supabase
      .from('twaats')
      .update({ scheduled_for: null, scheduled_published_at: now, created_at: now })
      .eq('id', twaat.id)
      .eq('scheduled_for', twaat.scheduled_for)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (publishError) {
      console.error(`Failed to publish scheduled Twaat ${twaat.id}:`, publishError);
      continue;
    }
    if (published) publishedCount++;
  }

  const { data: pendingOutcomes, error: pendingError } = await supabase
    .from('twaats')
    .select('id')
    .not('scheduled_published_at', 'is', null)
    .is('outcome_code', null)
    .is('deleted_at', null)
    .order('scheduled_published_at', { ascending: true })
    .limit(100);
  if (pendingError) throw pendingError;

  let outcomeAttempts = 0;
  let outcomeFailures = 0;

  for (const twaat of pendingOutcomes || []) {
    outcomeAttempts++;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/twaater-outcome-engine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({ twaat_id: twaat.id }),
      });
      if (!response.ok) {
        outcomeFailures++;
        console.error(
          `Outcome processing failed for scheduled Twaat ${twaat.id}: ${response.status} ${(await response.text()).slice(0, 500)}`,
        );
      }
    } catch (error) {
      outcomeFailures++;
      console.error(`Outcome processing request failed for scheduled Twaat ${twaat.id}: ${getErrorMessage(error)}`);
    }
  }

  return { publishedCount, outcomeAttempts, outcomeFailures };
}

async function processActivityCompletion(supabase: any, activity: ScheduledActivity) {
  const duration = (new Date(activity.scheduled_end).getTime() - new Date(activity.scheduled_start).getTime()) / 3600000;

  async function requireLinkedStatus(table: string, id: string, acceptedStates: string[]) {
    const { data, error } = await supabase.from(table).select('status').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || !acceptedStates.includes(data.status)) {
      throw new Error(`${table} ${id} has not confirmed its canonical completion`);
    }
  }

  switch (activity.activity_type) {
    case 'skill_practice': {
      const { error } = await supabase.rpc('complete_skill_practice', { p_activity_id: activity.id });
      if (error) throw error;
      break;
    }
    case 'gig':
      if (!activity.linked_gig_id) throw new Error('Gig schedule is missing a linked gig');
      {
        const { data: gig, error: gigError } = await supabase
          .from('gigs')
          .select('status, completed_at')
          .eq('id', activity.linked_gig_id)
          .maybeSingle();
        if (gigError) throw gigError;
        if (gig?.status === 'completed' || gig?.completed_at) break;
        requireWorkerSuccess('complete-gig', await supabase.functions.invoke('complete-gig', { body: { gigId: activity.linked_gig_id } }));
        await requireLinkedStatus('gigs', activity.linked_gig_id, ['completed']);
      }
      break;
    case 'rehearsal':
      if (!activity.linked_rehearsal_id) throw new Error('Rehearsal schedule is missing a linked rehearsal');
      {
        const { data, error } = await supabase.from('band_rehearsals')
          .select('status').eq('id', activity.linked_rehearsal_id).maybeSingle();
        if (error) throw error;
        if (data?.status === 'completed') break;
      }
      requireWorkerSuccess('complete-rehearsals', await supabase.functions.invoke('complete-rehearsals'));
      await requireLinkedStatus('band_rehearsals', activity.linked_rehearsal_id, ['completed']);
      break;
    case 'recording':
      if (!activity.linked_recording_id) throw new Error('Recording schedule is missing a linked session');
      {
        const { data, error } = await supabase.from('recording_sessions')
          .select('status').eq('id', activity.linked_recording_id).maybeSingle();
        if (error) throw error;
        if (data && ['recorded', 'completed'].includes(data.status)) break;
      }
      requireWorkerSuccess('complete-recording-sessions', await supabase.functions.invoke('complete-recording-sessions'));
      await requireLinkedStatus('recording_sessions', activity.linked_recording_id, ['recorded', 'completed']);
      break;
    case 'work':
      // The scheduler loop deliberately skips work until atomic settlement.
      break;
    case 'university':
      // Trusted hourly attendance + atomic XP RPC own this completion,
      // rather than prematurely marking a course before the local class ends.
      break;
    case 'reading': {
      // The attendance endpoint requires a trusted service-role bearer for
      // global processing. Forward the server-only key explicitly and surface
      // invocation failures so the activity is not falsely marked complete.
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!serviceRoleKey) throw new Error('Reading scheduler service credential is missing');
      const { data, error } = await supabase.functions.invoke('book-reading-attendance', {
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
        body: { triggeredBy: 'process-scheduled-activities' },
      });
      if (error) throw error;
      if (data?.success !== true) throw new Error(data?.error ?? 'Reading attendance processing failed');
      break;
    }
    case 'songwriting':
      requireWorkerSuccess('cleanup-songwriting', await supabase.functions.invoke('cleanup-songwriting'));
      break;
    case 'health': {
      const { data: profile, error: healthError } = await supabase
        .from('profiles')
        .select('id, health')
        .eq('id', activity.profile_id)
        .maybeSingle();
      if (healthError) throw healthError;
      if (!profile) throw new Error('Health activity character was not found');
      if (profile) {
        const healthGain = Math.min(20 * duration, 100 - (profile.health || 0));
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ health: (profile.health || 0) + healthGain })
          .eq('id', profile.id);
        if (updateError) throw updateError;
      }
      break;
    }
    case 'pr_appearance':
      if (!activity.metadata?.offer_id) throw new Error('PR appearance has no settlement offer reference');
      {
        const { data, error } = await supabase.from('pr_media_offers')
          .select('status').eq('id', activity.metadata.offer_id).maybeSingle();
        if (error) throw error;
        if (data?.status === 'completed') break;
      }
      requireWorkerSuccess('process-pr-activity', await supabase.functions.invoke('process-pr-activity', {
        body: { action: 'complete', offerId: activity.metadata.offer_id },
      }));
      await requireLinkedStatus('pr_media_offers', activity.metadata.offer_id, ['completed']);
      break;
    case 'self_promotion':
      if (!activity.metadata?.self_promotion_id) throw new Error('Promotion activity has no settlement reference');
      {
        // Same atomic settlement used by pg_cron. Never rely on a
        // browser-accessible Edge worker or ignore its HTTP error.
        const { data: outcome, error: promotionError } = await supabase.rpc(
          'settle_self_promotion_atomic',
          { p_activity_id: activity.metadata.self_promotion_id },
        );
        if (promotionError) throw promotionError;
        if (outcome?.settled !== true && outcome?.reason !== 'already_completed') {
          throw new Error(`Promotion not settled: ${outcome?.reason ?? 'unknown'}`);
        }
      }
      break;
    case 'film_production':
      // Intentionally settled by settle_film_contract_atomic() in the main
      // completion loop. That single SQL transaction owns cash, fame,
      // receipt, contract and schedule status (#4227).
      break;
    default:
      throw new Error(`No confirmed completion handler for activity type: ${activity.activity_type}`);
  }
}
