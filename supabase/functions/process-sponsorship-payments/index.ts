import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts'
import { authorizeInternalCronRequest } from '../_shared/internal-cron-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-triggered-by, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' } },
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    console.error('[process-sponsorship-payments] Internal service configuration missing')
    return new Response(JSON.stringify({ error: 'Service unavailable' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Authenticate before reading the body, writing job logs or paying anything.
  // Never accept a bearer JWT/anon key as a substitute for the Vault secret.
  const authResult = await authorizeInternalCronRequest(req, (secret) =>
    supabase.rpc('verify_internal_cron_secret', { p_secret: secret }),
  )
  if (authResult !== 'authorized') {
    console.warn('[process-sponsorship-payments] Rejected scheduled invocation', authResult)
    return new Response(
      JSON.stringify({ error: authResult === 'unavailable' ? 'Service unavailable' : 'Unauthorized' }),
      { status: authResult === 'unavailable' ? 503 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req)
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined

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
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
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

    for (const payment of duePayments || []) {
      try {
        const { data, error } = await supabase.rpc('process_sponsorship_installment_atomic', {
          p_payment_id: payment.id,
        });
        if (error) throw error;
        const result = data as { status: string; amount: number } | null;
        if (result?.status === 'paid') {
          paidCount++;
          totalPaid += Number(result.amount || 0);
        } else if (result?.status === 'cancelled') {
          console.log(`Cancelled obsolete installment ${payment.id}: contract not active`);
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
