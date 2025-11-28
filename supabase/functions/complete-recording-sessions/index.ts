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

    const { data: sessions, error: sessionsError } = await supabase
      .from('recording_sessions')
      .select('*')
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

        // Get user/band skills for base quality calculation
        let skillBasedQuality = 50
        
        if (session.user_id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('skill_levels, attributes')
            .eq('user_id', session.user_id)
            .single()
          
          const skillLevels = (profileData?.skill_levels as Record<string, number>) || {}
          const attributes = (profileData?.attributes as any) || { technical_mastery: 50 }
          
          // Calculate skill-based quality
          const mixingSkill = Math.min(100,
            (skillLevels['songwriting_basic_mixing'] || 0) * 0.6 +
            (skillLevels['songwriting_professional_mixing'] || 0) * 0.8 +
            (skillLevels['songwriting_mastery_mixing'] || 0) * 1.0
          )
          
          const dawSkill = Math.min(100,
            (skillLevels['songwriting_basic_daw'] || 0) * 0.6 +
            (skillLevels['songwriting_professional_daw'] || 0) * 0.8 +
            (skillLevels['songwriting_mastery_daw'] || 0) * 1.0
          )
          
          const productionSkill = Math.min(100,
            (skillLevels['songwriting_basic_record_production'] || 0) * 0.5 +
            (skillLevels['songwriting_professional_record_production'] || 0) * 0.75 +
            (skillLevels['songwriting_mastery_record_production'] || 0) * 1.0
          )
          
          const techBonus = Math.min(20, attributes.technical_mastery * 0.2)
          
          skillBasedQuality = Math.round(
            (mixingSkill * 0.35 + dawSkill * 0.35 + productionSkill * 0.30) + techBonus
          )
        }
        
        // Add variance (±12%)
        const variance = (Math.random() - 0.5) * 0.24
        const baseQuality = Math.max(25, Math.min(95, Math.round(skillBasedQuality * (1 + variance))))
        
        const producerBonus = session.producer_bonus || 0
        const equipmentBonus = session.equipment_bonus || 0
        const finalQuality = Math.min(100, baseQuality + producerBonus + equipmentBonus)

        const baseXpPerHour = 15
        const qualityMultiplier = finalQuality / 50
        const xpEarned = Math.floor(baseXpPerHour * durationHours * qualityMultiplier)

        console.log(`Quality: ${finalQuality}, XP: ${xpEarned}`)

        const { error: updateError } = await supabase
          .from('recording_sessions')
          .update({
            status: 'completed',
            actual_end: new Date().toISOString(),
            final_quality: finalQuality,
            xp_earned: xpEarned,
            notes: session.notes
              ? `${session.notes}\n\nAuto-completed: Quality ${finalQuality}/100, earned ${xpEarned} XP`
              : `Auto-completed: Quality ${finalQuality}/100, earned ${xpEarned} XP`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        if (updateError) {
          throw updateError
        }

        if (session.song_id) {
          await supabase
            .from('songs')
            .update({
              quality_score: finalQuality,
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.song_id)
        }

        if (session.band_id) {
          const { data: bandMembers } = await supabase
            .from('band_members')
            .select('profile_id, profiles(user_id)')
            .eq('band_id', session.band_id)
            .eq('status', 'active')

          for (const member of bandMembers || []) {
            if (member.profiles?.user_id) {
              await supabase.functions.invoke('progression', {
                body: {
                  action: 'award_action_xp',
                  amount: xpEarned,
                  category: 'performance',
                  action_key: 'recording_session',
                  metadata: {
                    session_id: session.id,
                    song_id: session.song_id,
                    final_quality: finalQuality,
                    duration_hours: durationHours,
                    auto_completed: true,
                  },
                },
              })
            }
          }
        } else if (session.user_id) {
          await supabase.functions.invoke('progression', {
            body: {
              action: 'award_action_xp',
              amount: xpEarned,
              category: 'performance',
              action_key: 'recording_session',
              metadata: {
                session_id: session.id,
                song_id: session.song_id,
                final_quality: finalQuality,
                duration_hours: durationHours,
                auto_completed: true,
              },
            },
          })
        }

        completedCount++
        totalXpAwarded += xpEarned
        averageFinalQuality += finalQuality
        console.log(`✓ Completed session ${session.id}: Quality ${finalQuality}, XP ${xpEarned}`)
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
