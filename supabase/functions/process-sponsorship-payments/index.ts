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
    const { data: duePayments, error: paymentsError } = await supabase
      .from('sponsorship_payments')
      .select(`
        *,
        contract:sponsorship_contracts(*)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (paymentsError) {
      console.error('Error fetching due payments:', paymentsError)
      throw paymentsError
    }

    console.log(`Found ${duePayments?.length || 0} payments due`)

    for (const payment of duePayments || []) {
      try {
        const contract = payment.contract
        if (!contract || contract.status !== 'active') {
          console.log(`Skipping payment ${payment.id} - contract not active`)
          continue
        }

        // Pay to band balance
        const { data: band, error: bandError } = await supabase
          .from('bands')
          .select('band_balance')
          .eq('id', payment.band_id)
          .single()

        if (bandError) {
          console.error(`Error fetching band ${payment.band_id}:`, bandError)
          errorCount++
          continue
        }

        const newBalance = (band.band_balance || 0) + payment.amount

        const { error: updateBandError } = await supabase
          .from('bands')
          .update({ band_balance: newBalance })
          .eq('id', payment.band_id)

        if (updateBandError) {
          console.error(`Error updating band balance:`, updateBandError)
          errorCount++
          continue
        }

        // Log the earning
        await supabase
          .from('band_earnings')
          .insert({
            band_id: payment.band_id,
            amount: payment.amount,
            source: 'sponsorship',
            description: `Weekly sponsorship payment (Week ${payment.week_number})`,
            metadata: {
              contract_id: contract.id,
              payment_id: payment.id,
              brand_id: contract.brand_id,
            }
          })

        // Mark payment as paid
        const { error: updatePaymentError } = await supabase
          .from('sponsorship_payments')
          .update({
            status: 'paid',
            paid_at: now,
          })
          .eq('id', payment.id)

        if (updatePaymentError) {
          console.error(`Error marking payment as paid:`, updatePaymentError)
          errorCount++
          continue
        }

        // Update contract weeks_paid and total_paid
        const newTotalPaid = (contract.total_paid || 0) + payment.amount
        const { error: updateContractError } = await supabase
          .from('sponsorship_contracts')
          .update({
            weeks_paid: payment.week_number,
            total_paid: newTotalPaid,
            last_payment_at: now,
          })
          .eq('id', contract.id)

        if (updateContractError) {
          console.error(`Error updating contract:`, updateContractError)
        }

        // Check if contract is complete
        if (payment.week_number >= contract.term_weeks) {
          await supabase
            .from('sponsorship_contracts')
            .update({ status: 'completed' })
            .eq('id', contract.id)
          
          console.log(`Contract ${contract.id} completed`)
        }

        paidCount++
        totalPaid += payment.amount
        console.log(`Paid $${payment.amount} for contract ${contract.id} (Week ${payment.week_number})`)

      } catch (error) {
        console.error(`Exception processing payment ${payment.id}:`, error)
        errorCount++
      }
    }

    console.log(`=== Sponsorship Payments Processing Complete ===`)
    console.log(`Paid: ${paidCount}, Total: $${totalPaid}, Errors: ${errorCount}`)

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
