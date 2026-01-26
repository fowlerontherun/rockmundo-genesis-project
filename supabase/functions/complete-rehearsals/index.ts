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
  let totalChemistryGain = 0

  try {
    console.log(`=== Rehearsal Auto-Completion Started at ${new Date().toISOString()} ===`)

    runId = await startJobRun({
      jobName: 'complete-rehearsals',
      functionName: 'complete-rehearsals',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    // First, transition scheduled rehearsals to in_progress if their start time has passed
    const { error: transitionError } = await supabase
      .from('band_rehearsals')
      .update({ status: 'in_progress' })
      .eq('status', 'scheduled')
      .lt('scheduled_start', new Date().toISOString())

    if (transitionError) {
      console.error('Error transitioning scheduled rehearsals:', transitionError)
    }

    // Now fetch rehearsals that are in_progress and past their scheduled end
    const { data: rehearsals, error: rehearsalsError } = await supabase
      .from('band_rehearsals')
      .select('*')
      .eq('status', 'in_progress')
      .lt('scheduled_end', new Date().toISOString())

    if (rehearsalsError) {
      console.error('Error fetching rehearsals:', rehearsalsError)
      throw rehearsalsError
    }

    console.log(`Found ${rehearsals?.length || 0} rehearsals to auto-complete`)

    for (const rehearsal of rehearsals || []) {
      try {
        console.log(`Processing rehearsal ${rehearsal.id} for band ${rehearsal.band_id}`)

        // Calculate duration in minutes
        const startTime = new Date(rehearsal.scheduled_start)
        const endTime = new Date(rehearsal.scheduled_end)
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
        const durationHours = durationMinutes / 60

        // Calculate XP and chemistry based on duration
        const baseXpPerHour = 10 + Math.floor(Math.random() * 10)
        const xpEarned = Math.floor(baseXpPerHour * durationHours)
        const chemistryGain = Math.floor(durationHours * 2) + 1 // ~2-3 per hour

        // Update rehearsal record
        const { error: updateError } = await supabase
          .from('band_rehearsals')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            xp_earned: xpEarned,
            chemistry_gain: chemistryGain,
            familiarity_gained: durationMinutes,
          })
          .eq('id', rehearsal.id)

        if (updateError) {
          throw updateError
        }

        // Award XP to band members
        const { data: bandMembers, error: membersError } = await supabase
          .from('band_members')
          .select('user_id')
          .eq('band_id', rehearsal.band_id)
          .eq('member_status', 'active')

        if (membersError) {
          throw membersError
        }

        for (const member of bandMembers || []) {
          if (member.user_id) {
            await supabase.functions.invoke('progression', {
              body: {
                user_id: member.user_id,
                action: 'award_action_xp',
                amount: xpEarned,
                category: 'practice',
                action_key: 'rehearsal',
                metadata: {
                  rehearsal_id: rehearsal.id,
                  band_id: rehearsal.band_id,
                  duration_hours: durationHours,
                  chemistry_gained: chemistryGain,
                  auto_completed: true,
                },
              },
            })
          }
        }

        // Update band chemistry
        if (chemistryGain > 0) {
          await supabase
            .rpc('increment_band_chemistry', {
              p_band_id: rehearsal.band_id,
              p_amount: chemistryGain,
            })
            .catch((err) => console.error('Error updating band chemistry:', err))
        }

        // Get songs to update - either from setlist or selected song
        let songsToUpdate: string[] = []
        
        if (rehearsal.setlist_id) {
          const { data: setlistSongs } = await supabase
            .from('setlist_songs')
            .select('song_id')
            .eq('setlist_id', rehearsal.setlist_id)

          songsToUpdate = setlistSongs?.map(s => s.song_id) || []
        } else if (rehearsal.selected_song_id) {
          songsToUpdate = [rehearsal.selected_song_id]
        }

        // Calculate familiarity minutes per song
        const minutesPerSong = songsToUpdate.length > 0 
          ? Math.floor(durationMinutes / songsToUpdate.length)
          : 0

        // Update familiarity for each song
        for (const songId of songsToUpdate) {
          const { data: existingFamiliarity } = await supabase
            .from('band_song_familiarity')
            .select('familiarity_minutes')
            .eq('band_id', rehearsal.band_id)
            .eq('song_id', songId)
            .maybeSingle()

          const currentMinutes = existingFamiliarity?.familiarity_minutes || 0
          const newMinutes = currentMinutes + minutesPerSong
          
          // Calculate rehearsal stage using database-compliant values
          // Valid stages: 'unlearned', 'learning', 'familiar', 'well_rehearsed', 'perfected'
          let rehearsalStage = 'unlearned'
          if (newMinutes >= 1800) {
            rehearsalStage = 'perfected'
          } else if (newMinutes >= 900) {
            rehearsalStage = 'well_rehearsed'
          } else if (newMinutes >= 300) {
            rehearsalStage = 'familiar'
          } else if (newMinutes >= 60) {
            rehearsalStage = 'learning'
          }

          const { error: familiarityError } = await supabase
            .from('band_song_familiarity')
            .upsert(
              {
                band_id: rehearsal.band_id,
                song_id: songId,
                familiarity_minutes: newMinutes,
                rehearsal_stage: rehearsalStage,
                last_rehearsed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'band_id,song_id',
              }
            )

          if (familiarityError) {
            console.error(`[complete-rehearsals] Error updating familiarity for song ${songId}:`, familiarityError)
          } else {
            console.log(`[complete-rehearsals] Updated familiarity for song ${songId}: ${currentMinutes} -> ${newMinutes} mins (${rehearsalStage})`)
          }

          // Update song_rehearsals table for tracking
          const { data: existingRehearsal } = await supabase
            .from('song_rehearsals')
            .select('rehearsal_level, times_rehearsed')
            .eq('band_id', rehearsal.band_id)
            .eq('song_id', songId)
            .maybeSingle()

          const newLevel = Math.min(10, (existingRehearsal?.rehearsal_level || 0) + 1)
          const timesRehearsed = (existingRehearsal?.times_rehearsed || 0) + 1

          await supabase
            .from('song_rehearsals')
            .upsert(
              {
                band_id: rehearsal.band_id,
                song_id: songId,
                rehearsal_level: newLevel,
                times_rehearsed: timesRehearsed,
                last_rehearsed: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'band_id,song_id',
              }
            )
        }

        completedCount++
        totalXpAwarded += xpEarned
        totalChemistryGain += chemistryGain
        console.log(`Completed rehearsal ${rehearsal.id}: ${xpEarned} XP, +${chemistryGain} chemistry, ${minutesPerSong}min per song`)
      } catch (error) {
        errorCount += 1
        console.error(`Error processing rehearsal ${rehearsal.id}:`, error)
      }
    }

    console.log(`=== Rehearsal Auto-Completion Complete: ${completedCount} rehearsals ===`)

    await completeJobRun({
      jobName: 'complete-rehearsals',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      processedCount: completedCount,
      errorCount,
      resultSummary: {
        completedCount,
        totalXpAwarded,
        totalChemistryGain,
        errorCount,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        completedRehearsals: completedCount,
        errors: errorCount,
        totalXpAwarded,
        totalChemistryGain,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    await failJobRun({
      jobName: 'complete-rehearsals',
      runId,
      supabaseClient: supabase,
      durationMs: Date.now() - startedAt,
      error,
      resultSummary: {
        completedCount,
        errorCount,
        totalXpAwarded,
        totalChemistryGain,
      },
    })

    console.error('Rehearsal completion error:', error)
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
