import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ProcessorRequest = {
  dryRun?: boolean;
  maxEvents?: number;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  const cronSecret = Deno.env.get('SCENE_PROCESSOR_CRON_SECRET');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  // Fail closed if any secret or service dependency is not configured.
  if (!cronSecret || !serviceKey || !supabaseUrl) {
    return json({ error: 'PROCESSOR_NOT_CONFIGURED' }, 503);
  }
  if (request.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  // This is independent of the database template / source-health flags.
  // Deploying this function never automatically starts processing.
  if (Deno.env.get('SCENE_CHALLENGES_PROCESSOR_ENABLED') !== 'true') {
    return json({ enabled: false, dryRun: true, message: 'Processor is disabled.' }, 503);
  }

  let body: ProcessorRequest = {};
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: 'INVALID_BODY' }, 400);
    body = raw.length ? JSON.parse(raw) : {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'INVALID_BODY' }, 400);
    }
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  const dryRun = body.dryRun !== false;
  const maxEvents = Number.isInteger(body.maxEvents) &&
    (body.maxEvents ?? 0) >= 1 && (body.maxEvents ?? 0) <= 100
      ? body.maxEvents!
      : 50;
  const now = new Date();
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    if (dryRun) {
      // The preview is read-only and uses the same persisted cursor and
      // finalisation settling window as the mutating database worker.
      const { data: preview, error: previewError } = await client
        .rpc('scene_preview_verified_jam_batch', { p_limit: maxEvents });
      if (previewError) throw previewError;

      const { data: recordingPreview, error: recordingPreviewError } = await client
        .rpc('scene_preview_completed_recording_batch', { p_limit: maxEvents });
      if (recordingPreviewError) throw recordingPreviewError;

      const { data: gigPreview, error: gigPreviewError } = await client
        .rpc('scene_preview_verified_gig_batch', { p_limit: maxEvents });
      if (gigPreviewError) throw gigPreviewError;

      const { data: rehearsalPreview, error: rehearsalPreviewError } = await client
        .rpc('scene_preview_verified_rehearsal_batch', { p_limit: maxEvents });
      if (rehearsalPreviewError) throw rehearsalPreviewError;

      return json({
        dryRun: true,
        configured: true,
        candidateSessions: Number(preview?.candidate_sessions ?? 0),
        backlogPending: preview?.backlog_pending === true,
        scoringSourcesReady: preview?.scoring_sources_ready === true,
        cursorAt: preview?.cursor_at ?? null,
        settledBefore: preview?.settled_before ?? null,
        recording: {
          candidateSessions: Number(recordingPreview?.candidate_sessions ?? 0),
          backlogPending: recordingPreview?.backlog_pending === true,
          scoringSourceReady: recordingPreview?.source_ready === true,
          cursorAt: recordingPreview?.cursor_at ?? null,
        },
        gigs: {
          candidateOutcomes: Number(gigPreview?.candidate_sessions ?? 0),
          backlogPending: gigPreview?.backlog_pending === true,
          scoringSourceReady: gigPreview?.source_ready === true,
          cursorAt: gigPreview?.cursor_at ?? null,
        },
        rehearsal: {
          candidateSessions: Number(rehearsalPreview?.candidate_sessions ?? 0),
          backlogPending: rehearsalPreview?.backlog_pending === true,
          scoringSourceReady: rehearsalPreview?.source_ready === true,
          cursorAt: rehearsalPreview?.cursor_at ?? null,
        },
        cyclesCreated: 0,
        eventsProcessed: 0,
        contributionRowsInserted: 0,
      });
    }

    // Reconcile only after an explicit non-dry-run request. Disabled templates
    // still produce zero cycles. The RPC is restricted to service_role.
    const { data: cycles, error: cyclesError } = await client
      .rpc('scene_reconcile_cycles', { p_at: now.toISOString() });
    if (cyclesError) throw cyclesError;

    // One database transaction processes the oldest eligible finalisations,
    // persists the ordered cursor, and rolls back all changes on any error.
    // Unlike a newest-first fixed scan, old queued events cannot be starved.
    const { data: batch, error: batchError } = await client
      .rpc('scene_process_verified_jam_batch', { p_limit: maxEvents });
    if (batchError) throw batchError;

    const { data: recordingBatch, error: recordingError } = await client
      .rpc('scene_process_completed_recording_batch', { p_limit: maxEvents });
    if (recordingError) throw recordingError;

    const { data: gigBatch, error: gigError } = await client
      .rpc('scene_process_verified_gig_batch', { p_limit: maxEvents });
    if (gigError) throw gigError;

    const { data: rehearsalBatch, error: rehearsalError } = await client
      .rpc('scene_process_verified_rehearsal_batch', { p_limit: maxEvents });
    if (rehearsalError) throw rehearsalError;

    const processingDisabled = batch?.disabled === true;
    const backlogPending = batch?.backlog_pending === true ||
      recordingBatch?.backlog_pending === true ||
      gigBatch?.backlog_pending === true ||
      rehearsalBatch?.backlog_pending === true;
    const allSourcesDisabled = processingDisabled &&
      recordingBatch?.disabled === true &&
      gigBatch?.disabled === true &&
      rehearsalBatch?.disabled === true;
    const processed = Number(batch?.events_processed ?? 0) +
      Number(recordingBatch?.events_processed ?? 0) +
      Number(gigBatch?.events_processed ?? 0) +
      Number(rehearsalBatch?.events_processed ?? 0);
    const inserted = Number(batch?.contributions_inserted ?? 0) +
      Number(recordingBatch?.contributions_inserted ?? 0) +
      Number(gigBatch?.contributions_inserted ?? 0) +
      Number(rehearsalBatch?.contributions_inserted ?? 0);

    const { data: milestones, error: milestoneError } = await client
      .rpc('scene_reconcile_milestones');
    if (milestoneError) throw milestoneError;

    // All reward policies remain disabled by default. Even when enabled,
    // this only books pending entitlements; it NEVER grants XP or fame.
    const { data: entitlements, error: entitlementError } = await client
      .rpc('scene_reconcile_reward_entitlements');
    if (entitlementError) throw entitlementError;

    return json({
      dryRun: false,
      cyclesCreated: Number(cycles ?? 0),
      posterMilestonesUnlocked: Number(milestones ?? 0),
      pendingRewardEntitlementsCreated: Number(entitlements ?? 0),
      eventsProcessed: processed,
      contributionRowsInserted: inserted,
      backlogPending,
      processingDisabled: allSourcesDisabled,
      sources: {
        jam: {
          disabled: processingDisabled,
          eventsProcessed: Number(batch?.events_processed ?? 0),
          contributionsInserted: Number(batch?.contributions_inserted ?? 0),
          backlogPending: batch?.backlog_pending === true,
        },
        recording: {
          disabled: recordingBatch?.disabled === true,
          eventsProcessed: Number(recordingBatch?.events_processed ?? 0),
          contributionsInserted: Number(recordingBatch?.contributions_inserted ?? 0),
          backlogPending: recordingBatch?.backlog_pending === true,
        },
        gig: {
          disabled: gigBatch?.disabled === true,
          eventsProcessed: Number(gigBatch?.events_processed ?? 0),
          contributionsInserted: Number(gigBatch?.contributions_inserted ?? 0),
          backlogPending: gigBatch?.backlog_pending === true,
        },
        rehearsal: {
          disabled: rehearsalBatch?.disabled === true,
          eventsProcessed: Number(rehearsalBatch?.events_processed ?? 0),
          contributionsInserted: Number(rehearsalBatch?.contributions_inserted ?? 0),
          backlogPending: rehearsalBatch?.backlog_pending === true,
        },
      },
      // A queued backlog is transparent; repeat explicitly or connect the
      // existing audited job scheduler only after all rollout gates pass.
      healthy: !allSourcesDisabled && !backlogPending,
    });
  } catch (error) {
    console.error('scene processor failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'PROCESSOR_FAILED' }, 500);
  }
});
