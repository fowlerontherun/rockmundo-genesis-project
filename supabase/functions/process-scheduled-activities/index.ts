import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from "../_shared/job-logger.ts";

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
    const scheduledTwaatResult = await publishDueScheduledTwaats(supabase, now, supabaseUrl, supabaseKey);

    const { data: toStart, error: startError } = await supabase
      .from('player_scheduled_activities')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_start', now)
      .gt('scheduled_end', now);
    if (startError) throw startError;

    for (const activity of toStart || []) {
      await supabase
        .from('player_scheduled_activities')
        .update({ status: 'in_progress', started_at: now })
        .eq('id', activity.id);
      startedCount++;
    }

    const { data: toComplete, error: completeError } = await supabase
      .from('player_scheduled_activities')
      .select('*')
      .eq('status', 'in_progress')
      .lte('scheduled_end', now);
    if (completeError) throw completeError;

    for (const activity of toComplete || []) {
      try {
        await processActivityCompletion(supabase, activity);
        await supabase
          .from('player_scheduled_activities')
          .update({ status: 'completed', completed_at: now })
          .eq('id', activity.id);
        completedCount++;
      } catch (error) {
        console.error(`Error processing activity ${activity.id}:`, error);
        if (activity.activity_type === 'skill_practice') {
          await supabase
            .from('player_scheduled_activities')
            .update({ metadata: { ...activity.metadata, completionError: getErrorMessage(error) } })
            .eq('id', activity.id)
            .eq('status', 'in_progress');
          continue;
        }
        await supabase
          .from('player_scheduled_activities')
          .update({ status: 'missed' })
          .eq('id', activity.id);
      }
    }

    const { data: toMiss } = await supabase
      .from('player_scheduled_activities')
      .select('id')
      .eq('status', 'scheduled')
      .lt('scheduled_end', now);

    if (toMiss?.length) {
      await supabase
        .from('player_scheduled_activities')
        .update({ status: 'missed' })
        .in('id', toMiss.map(a => a.id));
    }

    processedCount = startedCount + completedCount + scheduledTwaatResult.publishedCount;
    const resultSummary = {
      startedCount,
      completedCount,
      missedCount: toMiss?.length || 0,
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

  switch (activity.activity_type) {
    case 'skill_practice': {
      const { error } = await supabase.rpc('complete_skill_practice', { p_activity_id: activity.id });
      if (error) throw error;
      break;
    }
    case 'gig':
      if (activity.linked_gig_id) {
        const { data: gig } = await supabase
          .from('gigs')
          .select('status, completed_at')
          .eq('id', activity.linked_gig_id)
          .maybeSingle();
        if (gig?.status === 'completed' || gig?.completed_at) break;
        await supabase.functions.invoke('complete-gig', { body: { gigId: activity.linked_gig_id } });
      }
      break;
    case 'rehearsal':
      if (activity.linked_rehearsal_id) await supabase.functions.invoke('complete-rehearsals');
      break;
    case 'recording':
      if (activity.linked_recording_id) await supabase.functions.invoke('complete-recording-sessions');
      break;
    case 'work':
      if (activity.linked_job_shift_id) await supabase.functions.invoke('shift-clock-out');
      break;
    case 'university':
      await supabase.functions.invoke('university-attendance');
      break;
    case 'reading':
      await supabase.functions.invoke('book-reading-attendance');
      break;
    case 'songwriting':
      await supabase.functions.invoke('cleanup-songwriting');
      break;
    case 'health': {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, health')
        .eq('id', activity.profile_id)
        .maybeSingle();
      if (profile) {
        const healthGain = Math.min(20 * duration, 100 - (profile.health || 0));
        await supabase
          .from('profiles')
          .update({ health: (profile.health || 0) + healthGain })
          .eq('id', profile.id);
      }
      break;
    }
    case 'pr_appearance':
      if (activity.metadata?.offer_id) {
        await supabase.functions.invoke('process-pr-activity', {
          body: { action: 'complete', offerId: activity.metadata.offer_id },
        });
      }
      break;
    case 'self_promotion':
      if (activity.metadata?.self_promotion_id) {
        await supabase.functions.invoke('process-self-promotion', {
          body: { activityId: activity.metadata.self_promotion_id },
        });
      }
      break;
    case 'film_production':
      if (activity.metadata?.contract_id) {
        await supabase
          .from('player_film_contracts')
          .update({ status: 'completed' })
          .eq('id', activity.metadata.contract_id);
        const { data: contract } = await supabase
          .from('player_film_contracts')
          .select('*, film_productions(*)')
          .eq('id', activity.metadata.contract_id)
          .single();
        if (contract?.film_productions) {
          const film = contract.film_productions;
          await supabase.rpc('increment_user_cash', {
            p_user_id: activity.user_id,
            p_amount: film.compensation || 0,
          });
          await supabase.rpc('increment_user_fame', {
            p_user_id: activity.user_id,
            p_amount: film.fame_boost || 0,
          });
        }
      }
      break;
    default:
      console.log(`No specific processing for activity type: ${activity.activity_type}`);
  }
}
