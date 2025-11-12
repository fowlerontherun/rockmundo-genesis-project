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

        const startTime = new Date(rehearsal.scheduled_start)
        const endTime = new Date(rehearsal.scheduled_end)
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

        const baseXpPerHour = 10 + Math.floor(Math.random() * 10)
        const xpEarned = Math.floor(baseXpPerHour * durationHours)
        const chemistryGain = Math.floor(Math.random() * 5) + 3
        const familiarityGain = Math.floor(Math.random() * 10) + 10

        const { error: updateError } = await supabase
          .from('band_rehearsals')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            xp_earned: xpEarned,
            chemistry_gain: chemistryGain,
            familiarity_gained: familiarityGain,
          })
          .eq('id', rehearsal.id)

        if (updateError) {
          throw updateError
        }

        const { data: bandMembers, error: membersError } = await supabase
          .from('band_members')
          .select('profile_id')
          .eq('band_id', rehearsal.band_id)
          .eq('status', 'active')

        if (membersError) {
          throw membersError
        }

        for (const member of bandMembers || []) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', member.profile_id)
            .single()

          if (profile?.user_id) {
            await supabase.functions.invoke('progression', {
              body: {
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

        if (chemistryGain > 0) {
          await supabase
            .rpc('increment_band_chemistry', {
              p_band_id: rehearsal.band_id,
              p_amount: chemistryGain,
            })
            .catch((err) => console.error('Error updating band chemistry:', err))
        }

        if (rehearsal.setlist_id) {
          const { data: setlistSongs } = await supabase
            .from('setlist_songs')
            .select('song_id')
            .eq('setlist_id', rehearsal.setlist_id)

          for (const song of setlistSongs || []) {
            const { data: existingFamiliarity, error: familiarityFetchError } = await supabase
              .from('band_song_familiarity')
              .select('familiarity')
              .eq('band_id', rehearsal.band_id)
              .eq('song_id', song.song_id)
              .maybeSingle()

            if (familiarityFetchError) {
              throw familiarityFetchError
            }

            const updatedFamiliarity =
              (existingFamiliarity?.familiarity ?? 0) + familiarityGain

            await supabase
              .from('band_song_familiarity')
              .upsert(
                {
                  band_id: rehearsal.band_id,
                  song_id: song.song_id,
                  familiarity: updatedFamiliarity,
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'band_id,song_id',
                }
              )

            const { data: existingRehearsal } = await supabase
              .from('song_rehearsals')
              .select('rehearsal_level')
              .eq('band_id', rehearsal.band_id)
              .eq('song_id', song.song_id)
              .single()

            const newLevel = Math.min(10, (existingRehearsal?.rehearsal_level || 0) + 1)

            await supabase
              .from('song_rehearsals')
              .upsert(
                {
                  band_id: rehearsal.band_id,
                  song_id: song.song_id,
                  rehearsal_level: newLevel,
                  last_rehearsed: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: 'band_id,song_id',
                }
              )
          }
        }

        if (rehearsal.selected_song_id) {
          const { data: existingRehearsal } = await supabase
            .from('song_rehearsals')
            .select('rehearsal_level')
            .eq('band_id', rehearsal.band_id)
            .eq('song_id', rehearsal.selected_song_id)
            .single()

          const newLevel = Math.min(10, (existingRehearsal?.rehearsal_level || 0) + 1)

          await supabase
            .from('song_rehearsals')
            .upsert(
              {
                band_id: rehearsal.band_id,
                song_id: rehearsal.selected_song_id,
                rehearsal_level: newLevel,
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
        console.log(`Completed rehearsal ${rehearsal.id}: ${xpEarned} XP, +${chemistryGain} chemistry`)
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
