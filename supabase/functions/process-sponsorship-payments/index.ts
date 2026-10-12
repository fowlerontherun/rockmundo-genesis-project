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
    'authorization, x-client-info, apikey, content-type, x-triggered-by',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null }>(req)
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

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
