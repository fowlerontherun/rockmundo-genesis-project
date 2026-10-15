import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-triggered-by, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  // Never initiate financial operations through GET, HEAD or arbitrary verbs.
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', Allow: 'POST, OPTIONS' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // The service-role client is privileged and must NEVER execute payouts for
  // an unauthenticated HTTP caller. The schedule reads its private secret from
  // Vault at execution time; no hard-coded bearer key is accepted here.
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: cronAuthorized, error: cronAuthError } = await supabase.rpc(
    'verify_internal_cron_secret',
    { p_secret: cronSecret },
  )
  if (cronAuthError || cronAuthorized !== true) {
    console.warn('[process-sponsorship-payments] Rejected unauthorized invocation')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Only parse or persist job metadata after the authorization gate.
  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null; dryRun?: boolean }>(req)
  // The bearer secret is validated via header. Never copy arbitrary caller
  // JSON into persistent job logs: it could contain credentials or PII.
  const triggeredBy = 'authenticated_cron'
  const safePayload = { dryRun: payload?.dryRun === true }

  let runId: string | null = null
  const startedAt = Date.now()
  let paidCount = 0
  let errorCount = 0
  let totalPaid = 0

  try {
    console.log(`=== Sponsorship Payments Processing Started at ${new Date().toISOString()} ===`)

    runId = await startJobRun({
      jobName: 'process-sponsorship-payments',
      functionName: 'process-sponsorship-payments',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: safePayload,
      requestId: typeof payload?.requestId === 'string' &&
        /^[a-zA-Z0-9:_-]{1,100}$/.test(payload.requestId)
        ? payload.requestId : null,
    })

    const now = new Date().toISOString()

    // Get all scheduled payments that are due
    const duePayments: any[] = [];
    for (let offset = 0; ; offset += 500) {
    const { data: page, error: paymentsError } = await supabase
      .from('sponsorship_payments')
      .select(`
        *,
        contract:sponsorship_contracts(*)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + 499)
    if (paymentsError) throw paymentsError
    duePayments.push(...(page ?? []))
    if (!page || page.length < 500) break
    }

    console.log(`Found ${duePayments?.length || 0} payments due`)

    // Authenticated operations can verify the due-set safely without
    // transferring money. This is mandatory for a cron cutover smoke test.
    if (payload?.dryRun === true) {
      await completeJobRun({
        jobName: 'process-sponsorship-payments', runId,
        supabaseClient: supabase, durationMs: Date.now() - startedAt,
        processedCount: 0, errorCount: 0,
        resultSummary: { dryRun: true, dueCount: duePayments.length, paidCount: 0 },
      })
      return new Response(JSON.stringify({
        success: true, dryRun: true, paymentsDue: duePayments.length, paymentsPaid: 0,
        totalPaid: 0, errors: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    for (const payment of duePayments || []) {
      try {
        const { data, error } = await supabase.rpc('process_sponsorship_installment_atomic', {
          p_payment_id: payment.id,
        });
        if (error) throw error;
        const result = data as { status?: string; amount?: number } | null;
        // The DB RPC contract returns {status:'paid'|'cancelled',amount}.
        // Unknown / malformed responses are NOT a successful settlement.
        // A paid amount of zero is possible for an idempotent concurrent retry.
        const amount = Number(result?.amount);
        if (!Number.isSafeInteger(amount) || amount < 0) {
          throw new Error('Invalid atomic sponsorship settlement amount')
        }
        if (result?.status === 'paid') {
          paidCount++;
          totalPaid += amount;
        } else if (result?.status === 'cancelled' && amount === 0) {
          console.log(`Cancelled obsolete installment ${payment.id}: contract not active`);
        } else {
          throw new Error('Unexpected atomic sponsorship settlement status')
        }
      } catch (error) {
        console.error(`Failed atomic installment processing ${payment.id}:`, error);
        errorCount++;
      }
    }

    console.log(`=== Sponsorship Payments Processing Complete ===`)
    console.log(`Paid: ${paidCount}, Total: $${totalPaid}, Errors: ${errorCount}`)

    if (errorCount > 0) {
      throw new Error(`${errorCount} sponsorship payment operation(s) failed; job cannot be reported as successful`)
    }

    await completeJobRun({
      jobName: 'process-sponsorship-payments',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: paidCount,
      errorCount,
      resultSummary: {
        paidCount,
        totalPaid,
        errorCount,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        paymentsPaid: paidCount,
        totalPaid,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    await failJobRun({
      jobName: 'process-sponsorship-payments',
      runId,
      supabaseClient: supabase,
      error,
      durationMs: Date.now() - startedAt,
      processedCount: paidCount,
      errorCount,
      resultSummary: { paidCount, totalPaid, errorCount },
    })

    return new Response(
      JSON.stringify({ success: false, error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
