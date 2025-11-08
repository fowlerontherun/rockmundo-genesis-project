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
  let updatedCount = 0
  let errorCount = 0
  let totalProfiles = 0
  let totalXpAggregated = 0

  try {
    console.log(`=== Weekly Activity Calculation Started at ${new Date().toISOString()} ===`)

    runId = await startJobRun({
      jobName: 'calculate-weekly-activity',
      functionName: 'calculate-weekly-activity',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)

    console.log(`Calculating activity from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
      throw profilesError
    }

    totalProfiles = profiles?.length || 0
    console.log(`Processing ${totalProfiles} profiles`)

    for (const profile of profiles || []) {
      try {
        const { data: xpData, error: xpError } = await supabase
          .from('experience_ledger')
          .select('xp_amount')
          .eq('profile_id', profile.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())

        if (xpError) {
          console.error(`Error fetching XP for profile ${profile.id}:`, xpError)
          errorCount++
          continue
        }

        const totalXp = xpData?.reduce((sum, entry) => sum + (entry.xp_amount || 0), 0) || 0
        totalXpAggregated += totalXp

        const { error: updateError } = await supabase
          .from('player_weekly_activity')
          .upsert(
            {
              profile_id: profile.id,
              week_start: startDate.toISOString().split('T')[0],
              week_end: endDate.toISOString().split('T')[0],
              xp_earned: totalXp,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'profile_id,week_start',
            }
          )

        if (updateError) {
          console.error(`Error updating weekly activity for profile ${profile.id}:`, updateError)
          errorCount++
        } else {
          updatedCount++
          if (totalXp > 0) {
            console.log(`Profile ${profile.id}: ${totalXp} XP this week`)
          }
        }
      } catch (error) {
        console.error(`Exception processing profile ${profile.id}:`, error)
        errorCount++
      }
    }

    console.log(`=== Weekly Activity Calculation Complete ===`)
    console.log(`Updated: ${updatedCount}, Errors: ${errorCount}`)

    await completeJobRun({
      jobName: 'calculate-weekly-activity',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: updatedCount,
      errorCount,
      resultSummary: {
        updatedCount,
        errorCount,
        totalProfiles,
        totalXpAggregated,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        profilesProcessed: updatedCount,
        errors: errorCount,
        totalProfiles,
        totalXpAggregated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    await failJobRun({
      jobName: 'calculate-weekly-activity',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        updatedCount,
        errorCount,
        totalProfiles,
        totalXpAggregated,
      },
    })

    console.error('Weekly activity calculation error:', error)
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
