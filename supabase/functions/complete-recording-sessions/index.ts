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
  let completedCount = 0
  let errorCount = 0
  let totalXpAwarded = 0
  let averageFinalQuality = 0

  try {
    console.log(`=== Recording Session Auto-Completion Started at ${new Date().toISOString()} ===`)

    runId = await startJobRun({
      jobName: 'complete-recording-sessions',
      functionName: 'complete-recording-sessions',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    // Find in_progress sessions that have passed their scheduled_end time
    const { data: sessions, error: sessionsError } = await supabase
      .from('recording_sessions')
      .select('*, songs(quality_score)')
      .eq('status', 'in_progress')
      .lt('scheduled_end', new Date().toISOString())

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      throw sessionsError
    }

    console.log(`Found ${sessions?.length || 0} recording sessions to auto-complete`)

    for (const session of sessions || []) {
      try {
        console.log(`Processing recording session ${session.id}`)

        const startTime = new Date(session.scheduled_start)
        const endTime = new Date(session.scheduled_end)
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

        // Get current song quality
        const currentQuality = session.songs?.quality_score || 50

        // Calculate quality improvement based on duration and studio
        let studioQualityBonus = 0
        if (session.studio_id) {
          const { data: studioData } = await supabase
            .from('city_studios')
            .select('quality_rating')
            .eq('id', session.studio_id)
            .single()
          studioQualityBonus = (studioData?.quality_rating || 5) * 2
        }

        // Base improvement scales with duration (2-8 per hour)
        const baseImprovement = Math.floor(durationHours * (2 + Math.random() * 6))
        
        // Add studio bonus
        const qualityImprovement = Math.min(30, baseImprovement + studioQualityBonus)
        
        // Calculate new quality (capped at 100)
        const newQuality = Math.min(100, currentQuality + qualityImprovement)

        // Calculate XP earned
        const baseXpPerHour = 15
        const xpEarned = Math.floor(baseXpPerHour * durationHours * (1 + qualityImprovement / 50))

        console.log(`Quality improvement: ${qualityImprovement}, New quality: ${newQuality}, XP: ${xpEarned}`)

        // Update the recording session
        const { error: updateError } = await supabase
          .from('recording_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            quality_improvement: qualityImprovement,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        if (updateError) {
          throw updateError
        }

        // Update the song's quality score
        if (session.song_id) {
          await supabase
            .from('songs')
            .update({
              quality_score: newQuality,
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.song_id)
        }

        // Award XP to band members or user
        if (session.band_id) {
          const { data: bandMembers } = await supabase
            .from('band_members')
            .select('user_id')
            .eq('band_id', session.band_id)
            .in('member_status', ['active', null])

          for (const member of bandMembers || []) {
            if (member.user_id) {
              try {
                await supabase.functions.invoke('progression', {
                  body: {
                    action: 'award_action_xp',
                    amount: xpEarned,
                    category: 'performance',
                    action_key: 'recording_session',
                    metadata: {
                      session_id: session.id,
                      song_id: session.song_id,
                      quality_improvement: qualityImprovement,
                      duration_hours: durationHours,
                      auto_completed: true,
                    },
                  },
                })
              } catch (xpError) {
                console.error(`Failed to award XP to member ${member.user_id}:`, xpError)
              }
            }
          }
        } else if (session.user_id) {
          try {
            await supabase.functions.invoke('progression', {
              body: {
                action: 'award_action_xp',
                amount: xpEarned,
                category: 'performance',
                action_key: 'recording_session',
                metadata: {
                  session_id: session.id,
                  song_id: session.song_id,
                  quality_improvement: qualityImprovement,
                  duration_hours: durationHours,
                  auto_completed: true,
                },
              },
            })
          } catch (xpError) {
            console.error(`Failed to award XP to user ${session.user_id}:`, xpError)
          }
        }

        completedCount++
        totalXpAwarded += xpEarned
        averageFinalQuality += newQuality
        console.log(`✓ Completed session ${session.id}: Quality +${qualityImprovement} (now ${newQuality}), XP ${xpEarned}`)
      } catch (error) {
        errorCount += 1
        console.error(`Error processing session ${session.id}:`, error)
      }
    }

    if (completedCount > 0) {
      averageFinalQuality = Math.round((averageFinalQuality / completedCount) * 10) / 10
    }

    console.log(`=== Recording Session Auto-Completion Complete: ${completedCount} sessions ===`)

    await completeJobRun({
      jobName: 'complete-recording-sessions',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: completedCount,
      errorCount,
      resultSummary: {
        completedCount,
        totalXpAwarded,
        averageFinalQuality,
        errorCount,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        completedSessions: completedCount,
        errors: errorCount,
        totalXpAwarded,
        averageFinalQuality,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    await failJobRun({
      jobName: 'complete-recording-sessions',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        completedCount,
        errorCount,
        totalXpAwarded,
        averageFinalQuality,
      },
    })

    console.error('Recording session completion error:', error)
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
