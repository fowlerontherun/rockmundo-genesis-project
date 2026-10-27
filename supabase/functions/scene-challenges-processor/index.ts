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
  const lastSevenDays = new Date(now.getTime() - 7 * 86_400_000);
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Only the durable finalisation table is scanned. A browser booking, jam
    // invitation or 'completed' flag is not sufficient evidence to score.
    const { data: candidates, error: candidatesError } = await client
      .from('jam_session_finalizations')
      .select('session_id,applied_at')
      .gte('applied_at', lastSevenDays.toISOString())
      .lte('applied_at', now.toISOString())
      .order('applied_at', { ascending: false })
      .limit(maxEvents + 1);

    if (candidatesError) throw candidatesError;

    const hasMore = (candidates?.length ?? 0) > maxEvents;
    const selected = (candidates ?? []).slice(0, maxEvents);
    if (dryRun) {
      return json({
        dryRun: true,
        configured: true,
        candidateSessions: selected.length,
        truncated: hasMore,
        lastSevenDays: lastSevenDays.toISOString(),
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

    let processed = 0;
    let inserted = 0;
    const failedSessionIds: string[] = [];
    for (const record of selected) {
      const { data: credited, error } = await client
        .rpc('scene_ingest_verified_jam', { p_session_id: record.session_id });
      if (error) {
        failedSessionIds.push(record.session_id);
        continue;
      }
      processed += 1;
      inserted += Number(credited ?? 0);
    }

    return json({
      dryRun: false,
      cyclesCreated: Number(cycles ?? 0),
      candidateSessions: selected.length,
      truncated: hasMore,
      eventsProcessed: processed,
      contributionRowsInserted: inserted,
      failedSessions: failedSessionIds.length,
      // A non-empty failed list or truncated scan is a degraded run,
      // not a quiet all-clear. Inspect before enabling a recurring job.
      healthy: failedSessionIds.length === 0 && !hasMore,
    }, failedSessionIds.length ? 207 : 200);
  } catch (error) {
    console.error('scene processor failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'PROCESSOR_FAILED' }, 500);
  }
});
