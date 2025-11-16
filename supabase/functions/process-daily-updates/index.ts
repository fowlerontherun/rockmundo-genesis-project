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
  let processedProfiles = 0
  let processedBands = 0
  let errorCount = 0

  try {
    console.log(`=== Daily Updates Started at ${new Date().toISOString()} ===`)

    runId = await startJobRun({
      jobName: 'process-daily-updates',
      functionName: 'process-daily-updates',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    const today = new Date().toISOString().split('T')[0]

    // Process profiles - award daily fame based on activity
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, fame')

    if (profilesError) throw profilesError

    for (const profile of profiles || []) {
      try {
        // Calculate daily fame gain based on recent activity
        const { data: recentXp } = await supabase
          .from('experience_ledger')
          .select('xp_amount')
          .eq('profile_id', profile.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const dailyXp = recentXp?.reduce((sum, entry) => sum + (entry.xp_amount || 0), 0) || 0
        
        // Base daily fame is 1, plus 1 fame per 100 XP earned yesterday
        const fameGain = Math.max(1, Math.floor(1 + dailyXp / 100))

        await supabase
          .from('profiles')
          .update({ fame: (profile.fame || 0) + fameGain })
          .eq('id', profile.id)

        processedProfiles++
      } catch (error) {
        console.error(`Error processing profile ${profile.id}:`, error)
        errorCount++
      }
    }

    // Process bands - award daily fame and fans
    const { data: bands, error: bandsError } = await supabase
      .from('bands')
      .select('id, fame, weekly_fans')

    if (bandsError) throw bandsError

    for (const band of bands || []) {
      try {
        // Get band's recent activity through gigs, releases, etc
        const { data: recentGigs } = await supabase
          .from('gigs')
          .select('id')
          .eq('band_id', band.id)
          .gte('date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        const gigsCount = recentGigs?.length || 0
        
        // Base daily fame/fans for active bands
        const baseFameGain = 1
        const baseFansGain = Math.floor((band.fame || 0) * 0.001) // 0.1% of current fame

        // Bonus from recent activity
        const activityBonus = gigsCount * 10

        const totalFameGain = baseFameGain + activityBonus
        const totalFansGain = baseFansGain + (gigsCount * 5)

        await supabase
          .from('bands')
          .update({
            fame: (band.fame || 0) + totalFameGain,
            weekly_fans: (band.weekly_fans || 0) + totalFansGain
          })
          .eq('id', band.id)

        // Log the fame event
        await supabase
          .from('band_fame_events')
          .insert({
            band_id: band.id,
            event_type: 'daily_growth',
            fame_gained: totalFameGain,
            event_data: {
              fans_gained: totalFansGain,
              gigs_count: gigsCount,
              date: today
            }
          })

        processedBands++
      } catch (error) {
        console.error(`Error processing band ${band.id}:`, error)
        errorCount++
      }
    }

    console.log(`=== Daily Updates Complete ===`)
    console.log(`Profiles: ${processedProfiles}, Bands: ${processedBands}, Errors: ${errorCount}`)

    await completeJobRun({
      jobName: 'process-daily-updates',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: processedProfiles + processedBands,
      errorCount,
      resultSummary: {
        profiles_processed: processedProfiles,
        bands_processed: processedBands,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        profiles_processed: processedProfiles,
        bands_processed: processedBands,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Fatal error in daily updates:', error)

    if (runId) {
      await failJobRun({
        jobName: 'process-daily-updates',
        runId,
        supabaseClient: supabase,
        errorMessage: getErrorMessage(error),
      })
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: getErrorMessage(error),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
