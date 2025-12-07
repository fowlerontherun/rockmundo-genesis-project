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
  let completedSessions = 0
  let convertedProjects = 0
  let xpAwardedCount = 0
  let xpAwardErrors = 0

  try {
    runId = await startJobRun({
      jobName: 'cleanup-songwriting',
      functionName: 'cleanup-songwriting',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    // Call the database function to auto-complete sessions
    const { data: autoCompleteResult, error: autoCompleteError } = await supabase
      .rpc('auto_complete_songwriting_sessions')

    if (autoCompleteError) {
      console.error('Auto-complete error:', autoCompleteError)
      throw autoCompleteError
    }

    completedSessions = autoCompleteResult?.[0]?.completed_sessions || 0
    convertedProjects = autoCompleteResult?.[0]?.converted_projects || 0

    console.log(`Auto-completed ${completedSessions} sessions, converted ${convertedProjects} projects`)

    // Award XP for auto-completed sessions
    if (completedSessions > 0) {
      const { data: sessions } = await supabase
        .from('songwriting_sessions')
        .select(`
          id, 
          xp_earned, 
          project_id,
          user_id
        `)
        .eq('auto_completed', true)
        .is('xp_awarded', null)
        .limit(completedSessions)

      for (const session of sessions || []) {
        try {
          if (session.xp_earned && session.user_id) {
            await supabase.functions.invoke('progression', {
              body: {
                action: 'award_action_xp',
                amount: session.xp_earned,
                category: 'practice',
                action_key: 'songwriting_session',
                metadata: {
                  session_id: session.id,
                  project_id: session.project_id,
                  auto_completed: true,
                },
              },
            })

            await supabase
              .from('songwriting_sessions')
              .update({ xp_awarded: true })
              .eq('id', session.id)

            xpAwardedCount += 1
          }
        } catch (xpError) {
          xpAwardErrors += 1
          console.error(`Error awarding XP for session ${session.id}:`, xpError)
        }
      }
    }

    await completeJobRun({
      jobName: 'cleanup-songwriting',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: completedSessions,
      errorCount: xpAwardErrors,
      resultSummary: {
        completedSessions,
        convertedProjects,
        xpAwardsIssued: xpAwardedCount,
        xpAwardErrors,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        completedSessions,
        convertedProjects,
        xpAwardsIssued: xpAwardedCount,
        xpAwardErrors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    await failJobRun({
      jobName: 'cleanup-songwriting',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        completedSessions,
        convertedProjects,
        xpAwardsIssued: xpAwardedCount,
        xpAwardErrors,
      },
    })

    console.error('Cleanup error:', error)
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
