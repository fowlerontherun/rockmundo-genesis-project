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

type RehearsalStage = 'unlearned' | 'learning' | 'familiar' | 'well_rehearsed' | 'perfected';

function calculateRehearsalStage(totalMinutes: number): RehearsalStage {
  if (totalMinutes >= 360) return 'perfected';
  if (totalMinutes >= 300) return 'well_rehearsed';
  if (totalMinutes >= 180) return 'familiar';
  if (totalMinutes >= 60) return 'learning';
  return 'unlearned';
}

interface CompletedRehearsal {
  rehearsalId: string;
  bandId: string;
  songResults: {
    songId: string;
    songTitle: string;
    previousMinutes: number;
    addedMinutes: number;
    newMinutes: number;
    newStage: RehearsalStage;
  }[];
  chemistryGain: number;
  xpEarned: number;
  durationHours: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null; userId?: string }>(req)
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined
  const userId = payload?.userId

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  let runId: string | null = null
  const startedAt = Date.now()
  let completedCount = 0
  let errorCount = 0
  let totalXpAwarded = 0
  let totalChemistryGain = 0
  const completedRehearsals: CompletedRehearsal[] = []

  try {
    console.log(`=== Rehearsal Auto-Completion Started at ${new Date().toISOString()} ===`)
    console.log(`[complete-rehearsals] userId: ${userId || 'global cron'}`)

    runId = await startJobRun({
      jobName: 'complete-rehearsals',
      functionName: 'complete-rehearsals',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    // Build query for rehearsals
    let bandIds: string[] = []
    
    if (userId) {
      // Get user's bands
      const { data: bandMemberships, error: bandError } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('user_id', userId)

      if (bandError) {
        console.error('[complete-rehearsals] Error fetching bands:', bandError)
        throw bandError
      }

      bandIds = bandMemberships?.map(b => b.band_id) || []
      
      if (bandIds.length === 0) {
        return new Response(
          JSON.stringify({ completed: [], message: 'No bands found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // First, transition scheduled rehearsals to in_progress if their start time has passed
    let transitionQuery = supabase
      .from('band_rehearsals')
      .update({ status: 'in_progress' })
      .eq('status', 'scheduled')
      .lt('scheduled_start', new Date().toISOString())

    if (bandIds.length > 0) {
      transitionQuery = transitionQuery.in('band_id', bandIds)
    }

    const { error: transitionError } = await transitionQuery

    if (transitionError) {
      console.error('Error transitioning scheduled rehearsals:', transitionError)
    }

    // Now fetch rehearsals that are in_progress and past their scheduled end
    let rehearsalsQuery = supabase
      .from('band_rehearsals')
      .select('*')
      .eq('status', 'in_progress')
      .lt('scheduled_end', new Date().toISOString())

    if (bandIds.length > 0) {
      rehearsalsQuery = rehearsalsQuery.in('band_id', bandIds)
    }

    const { data: rehearsals, error: rehearsalsError } = await rehearsalsQuery

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
        const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
        const durationHours = durationMinutes / 60

        // Calculate XP and chemistry based on duration
        const baseXpPerHour = 10 + Math.floor(Math.random() * 10)
        const xpEarned = Math.floor(baseXpPerHour * durationHours)
        const chemistryGain = Math.floor(durationHours * 2) + 1

        // Update rehearsal record - this will trigger the database trigger
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

        // Get songs to update - either from setlist or selected song
        const songsToUpdate: string[] = []
        
        if (rehearsal.selected_song_id) {
          songsToUpdate.push(rehearsal.selected_song_id)
        }
        
        if (rehearsal.setlist_id) {
          const { data: setlistSongs } = await supabase
            .from('setlist_songs')
            .select('song_id')
            .eq('setlist_id', rehearsal.setlist_id)
            .not('song_id', 'is', null)

          setlistSongs?.forEach(s => {
            if (s.song_id && !songsToUpdate.includes(s.song_id)) {
              songsToUpdate.push(s.song_id)
            }
          })
        }

        const songResults: CompletedRehearsal['songResults'] = []
        const minutesPerSong = songsToUpdate.length > 0 
          ? Math.floor(durationMinutes / songsToUpdate.length)
          : 0

        if (songsToUpdate.length > 0) {
          // Fetch song titles
          const { data: songsData } = await supabase
            .from('songs')
            .select('id, title')
            .in('id', songsToUpdate)
          
          const songTitleMap = new Map((songsData || []).map(s => [s.id, s.title]))

          // Update familiarity for each song (using service role - bypasses RLS)
          for (const songId of songsToUpdate) {
            try {
              const { data: existingFamiliarity } = await supabase
                .from('band_song_familiarity')
                .select('familiarity_minutes')
                .eq('band_id', rehearsal.band_id)
                .eq('song_id', songId)
                .maybeSingle()

              const currentMinutes = existingFamiliarity?.familiarity_minutes || 0
              const newMinutes = currentMinutes + minutesPerSong
              const newStage = calculateRehearsalStage(newMinutes)

              console.log(`[complete-rehearsals] Song ${songId}: ${currentMinutes} -> ${newMinutes} (${newStage})`)

              // Upsert using service role (bypasses RLS entirely)
              const { error: upsertError } = await supabase
                .from('band_song_familiarity')
                .upsert({
                  band_id: rehearsal.band_id,
                  song_id: songId,
                  familiarity_minutes: newMinutes,
                  familiarity_percentage: Math.min(100, Math.floor((newMinutes * 100) / 360)),
                  rehearsal_stage: newStage,
                  last_rehearsed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'band_id,song_id',
                })

              if (upsertError) {
                console.error(`[complete-rehearsals] Error upserting familiarity for song ${songId}:`, upsertError)
              } else {
                songResults.push({
                  songId,
                  songTitle: songTitleMap.get(songId) || 'Unknown Song',
                  previousMinutes: currentMinutes,
                  addedMinutes: minutesPerSong,
                  newMinutes,
                  newStage,
                })
              }
            } catch (songError) {
              console.error(`[complete-rehearsals] Error processing song ${songId}:`, songError)
            }
          }
        }

        // Update band chemistry
        if (chemistryGain > 0) {
          const { data: band } = await supabase
            .from('bands')
            .select('chemistry_level')
            .eq('id', rehearsal.band_id)
            .single()
          
          if (band) {
            const newChemistry = Math.min(100, (band.chemistry_level || 0) + chemistryGain)
            await supabase
              .from('bands')
              .update({ chemistry_level: newChemistry })
              .eq('id', rehearsal.band_id)
          }
        }

        // Award XP to band members
        const { data: bandMembers } = await supabase
          .from('band_members')
          .select('user_id')
          .eq('band_id', rehearsal.band_id)
          .eq('member_status', 'active')

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
            }).catch(err => console.error('Error awarding XP:', err))
          }
        }

        completedRehearsals.push({
          rehearsalId: rehearsal.id,
          bandId: rehearsal.band_id,
          songResults,
          chemistryGain,
          xpEarned,
          durationHours,
        })

        completedCount++
        totalXpAwarded += xpEarned
        totalChemistryGain += chemistryGain
        console.log(`Completed rehearsal ${rehearsal.id}: ${xpEarned} XP, +${chemistryGain} chemistry, ${songResults.length} songs updated`)
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
        completed: completedRehearsals,
        count: completedCount,
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
