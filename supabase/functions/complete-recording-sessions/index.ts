import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts'
import { calculateRecordingOutcome } from '../_shared/recordingOutcomeCalculator.ts'

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

    // Find sessions that have passed their scheduled_end time
    const nowIso = new Date().toISOString()
    console.log(`Querying for sessions with scheduled_end < ${nowIso}`)
    const { data: rawSessions, error: sessionsError } = await supabase
      .from('recording_sessions')
      .select('*')
      .in('status', ['in_progress', 'scheduled'])
      .lt('scheduled_end', nowIso)

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      throw sessionsError
    }

    console.log(`Found ${rawSessions?.length || 0} raw recording sessions`)

    // Hydrate song info separately (avoid embed edge-cases)
    const songIds = Array.from(new Set((rawSessions || []).map((s: any) => s.song_id).filter(Boolean)))
    const songMap = new Map<string, any>()
    if (songIds.length > 0) {
      const { data: songRows } = await supabase
        .from('songs')
        .select('id, quality_score, title, genre, lyrics, user_id, band_id, duration_seconds, duration_display, songwriting_project_id')
        .in('id', songIds)
      for (const row of songRows || []) songMap.set((row as any).id, row)
    }
    const sessions = (rawSessions || []).map((s: any) => ({ ...s, songs: s.song_id ? songMap.get(s.song_id) || null : null }))

    console.log(`Found ${sessions.length} recording sessions to auto-complete`)

    for (const session of sessions || []) {
      try {
        console.log(`Processing recording session ${session.id}`)

        // === Location validation ===
        const studioCityId = (session as any).city_id || null
        let locationCityId = studioCityId

        // If no city_id on session, look it up from the studio
        if (!locationCityId && session.studio_id) {
          const { data: studioCity } = await supabase
            .from('city_studios')
            .select('city_id')
            .eq('id', session.studio_id)
            .single()
          locationCityId = studioCity?.city_id || null
        }

        if (locationCityId) {
          let missingMembers: string[] = []

          if (session.band_id) {
            // Band session: check all active non-touring members
            const { data: members } = await supabase
              .from('band_members')
              .select('user_id')
              .eq('band_id', session.band_id)
              .in('member_status', ['active'])
              .eq('is_touring_member', false)

            // Look up each member's city from profiles (band_members.current_city_id is unreliable)
            const memberCities = await Promise.all(
              (members || []).filter(m => m.user_id).map(async (m) => {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('current_city_id')
                  .eq('user_id', m.user_id)
                  .eq('is_active', true)
                  .is('died_at', null)
                  .maybeSingle()
                return { user_id: m.user_id, current_city_id: profile?.current_city_id ?? null }
              })
            )

            missingMembers = memberCities
              .filter(m => m.current_city_id !== locationCityId)
              .map(m => m.user_id)
              .filter(Boolean) as string[]
          } else if (session.user_id) {
            // Solo session: check the user's current city
            const { data: profile } = await supabase
              .from('profiles')
              .select('current_city_id')
              .eq('user_id', session.user_id)
              .single()

            if (profile && profile.current_city_id !== locationCityId) {
              missingMembers = [session.user_id]
            }
          }

          if (missingMembers.length > 0) {
            console.log(`Session ${session.id} FAILED: ${missingMembers.length} member(s) not in studio city`)
            
            const { error: failError } = await supabase
              .from('recording_sessions')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                session_data: { failure_reason: 'Band members were not in the studio city', missing_members: missingMembers },
              })
              .eq('id', session.id)

            if (failError) console.error(`Failed to mark session ${session.id} as failed:`, failError)
            errorCount++
            continue
          }
        }

        const startTime = new Date(session.scheduled_start)
        const endTime = new Date(session.scheduled_end)
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

        const currentQuality = session.songs?.quality_score || 50

        const { data: studioData } = session.studio_id
          ? await supabase
              .from('city_studios')
              .select('quality_rating, equipment_rating')
              .eq('id', session.studio_id)
              .maybeSingle()
          : { data: null } as any

        const { data: bandData } = session.band_id
          ? await supabase
              .from('bands')
              .select('morale, reputation_score, fan_sentiment_score, chemistry, band_chemistry, cohesion')
              .eq('id', session.band_id)
              .maybeSingle()
          : { data: null } as any

        const { data: memberRows } = session.band_id
          ? await supabase
              .from('band_members')
              .select('profile_id, user_id, instrument_role, role, member_status')
              .eq('band_id', session.band_id)
              .in('member_status', ['active'])
          : { data: [] } as any

        let soloProfileId = session.profile_id || null
        if (!session.band_id && !soloProfileId && session.user_id) {
          const { data: activeSoloProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', session.user_id)
            .eq('is_active', true)
            .is('died_at', null)
            .maybeSingle()
          soloProfileId = activeSoloProfile?.id || null
        }

        const soloProfiles = !session.band_id
          ? [{ profile_id: soloProfileId, user_id: session.user_id, instrument_role: 'lead_vocals', role: 'lead_vocals' }]
          : []
        const participants = [...(memberRows || []), ...soloProfiles]

        const performerInputs = await Promise.all(participants.map(async (member: any) => {
          const profileId = member.profile_id || session.profile_id
          const { data: profile } = profileId
            ? await supabase
                .from('profiles')
                .select('health, energy, motivation, physical_health')
                .eq('id', profileId)
                .maybeSingle()
            : { data: null } as any
          const { data: skillRows } = profileId
            ? await supabase
                .from('player_skills')
                .select('skill_id, skill_slug, level')
                .eq('profile_id', profileId)
            : { data: [] } as any
          const skills = Object.fromEntries((skillRows || []).map((row: any) => [row.skill_slug || row.skill_id, row.level || 0]))
          const attrs = { physical_health: (profile as any)?.physical_health ?? (profile as any)?.health ?? 75 }
          return {
            profileId: profileId || member.user_id || session.user_id,
            role: member.instrument_role || member.role || 'lead_vocals',
            accepted: true,
            attended: true,
            skills,
            attributes: attrs,
            songFamiliarity: 40,
            rehearsalReadiness: 40,
            health: (profile as any)?.health ?? 85,
            energy: (profile as any)?.energy ?? 85,
            focus: (profile as any)?.motivation ?? attrs.mental_focus ?? 75,
            equipmentQuality: 55,
            equipmentSuitability: 60,
          }
        }))

        const requiredRoles = Array.from(new Set([
          'lead_vocals',
          ...performerInputs.map((p: any) => p.role).filter(Boolean),
          ...(performerInputs.length > 1 ? ['bass', 'drums'] : []),
        ]))

        const outcome = calculateRecordingOutcome({
          sessionId: session.id,
          songId: session.song_id,
          sourceSongQuality: currentQuality,
          genre: session.songs?.genre,
          requiredRoles,
          performers: performerInputs,
          studio: {
            id: session.studio_id,
            quality: (studioData as any)?.quality_rating ?? 55,
            equipment: (studioData as any)?.equipment_rating ?? (studioData as any)?.quality_rating ?? 55,
          },
          engineer: { kind: 'studio_default', rating: (studioData as any)?.equipment_rating ?? (studioData as any)?.quality_rating ?? 50 },
          producer: session.player_producer_id
            ? { id: session.player_producer_id, kind: 'player', rating: 55 }
            : session.producer_id
              ? { id: session.producer_id, kind: 'npc', rating: 60 }
              : null,
          sessionMode: session.recording_type || session.session_data?.sessionMode || 'professional',
          effortHours: durationHours,
          bandCohesion: (bandData as any)?.cohesion ?? (bandData as any)?.band_chemistry ?? (bandData as any)?.chemistry ?? 50,
          chemistry: (bandData as any)?.chemistry ?? (bandData as any)?.band_chemistry ?? 50,
          seed: `${session.id}:${session.updated_at || session.scheduled_end}`,
        })

        const qualityImprovement = outcome.qualityImprovement
        const newQuality = outcome.finalMasterQuality
        const xpEarned = outcome.xpAwards.reduce((sum, award) => sum + award.amount, 0)
        console.log(`Recording outcome ${outcome.balanceVersion}: final=${newQuality}, variance=${outcome.appliedVariance}`)
        console.log(`Quality improvement: ${qualityImprovement}, New quality: ${newQuality}, XP: ${xpEarned}`)

        // Update the recording session
        const { error: updateError } = await supabase
          .from('recording_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            quality_improvement: qualityImprovement,
            calculation_version: outcome.balanceVersion,
            source_song_quality: outcome.sourceSongQuality,
            final_master_quality: outcome.finalMasterQuality,
            applied_variance: outcome.appliedVariance,
            outcome_breakdown: outcome.breakdown,
            xp_awards: outcome.xpAwards,
            recording_credits: (outcome.breakdown as any).performerBreakdowns || [],
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        if (updateError) {
          throw updateError
        }

        // Handle song update based on recording version
        if (session.song_id && session.songs) {
          const originalSong = session.songs
          const recordingVersion = session.recording_version || 'standard'
          
          // For acoustic/remix versions, create a new song entry
          if (recordingVersion !== 'standard') {
            console.log(`Recording version is ${recordingVersion}, checking for existing version...`)
            
            // Check if this version already exists
            const { data: existingVersion } = await supabase
              .from('songs')
              .select('id')
              .eq('parent_song_id', session.song_id)
              .eq('version', recordingVersion)
              .single()
            
            let targetSongId = session.song_id
            
            if (existingVersion) {
              // Update existing version song's quality
              console.log(`Found existing ${recordingVersion} version, updating quality...`)
              targetSongId = existingVersion.id
              
              const { error: versionUpdateError } = await supabase
                .from('songs')
                .update({
                  quality_score: newQuality,
                  status: 'recorded',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingVersion.id)
              
              if (versionUpdateError) {
                console.error(`Failed to update version song ${existingVersion.id}:`, versionUpdateError)
              } else {
                console.log(`Updated ${recordingVersion} version song ${existingVersion.id}: quality=${newQuality}`)
              }
            } else {
              // Create a new version song
              const versionLabel = recordingVersion === 'acoustic' ? 'Acoustic' : 'Remix'
              const newTitle = `${originalSong.title} (${versionLabel})`
              
              console.log(`Creating new ${recordingVersion} version: "${newTitle}"`)
              
              const { data: newSong, error: createError } = await supabase
                .from('songs')
                .insert({
                  user_id: originalSong.user_id,
                  band_id: session.band_id || originalSong.band_id,
                  title: newTitle,
                  genre: originalSong.genre,
                  lyrics: originalSong.lyrics,
                  quality_score: newQuality,
                  status: 'recorded',
                  parent_song_id: session.song_id,
                  version: recordingVersion,
                  duration_seconds: originalSong.duration_seconds,
                  duration_display: originalSong.duration_display,
                  songwriting_project_id: originalSong.songwriting_project_id,
                })
                .select('id')
                .single()
              
              if (createError) {
                console.error(`Failed to create ${recordingVersion} version:`, createError)
              } else if (newSong) {
                targetSongId = newSong.id
                console.log(`✓ Created ${recordingVersion} version song ${newSong.id}: "${newTitle}" quality=${newQuality}`)
                
                // Update session to point to new song
                await supabase
                  .from('recording_sessions')
                  .update({ song_id: newSong.id })
                  .eq('id', session.id)
              }
            }
            
            // Trigger audio generation for the version song (automatic on recording completion)
            if (targetSongId) {
              try {
                const { data: versionSongData } = await supabase
                  .from('songs')
                  .select('user_id, audio_url, audio_generation_status, songwriting_project_id')
                  .eq('id', targetSongId)
                  .single()

                if (versionSongData?.user_id &&
                    !versionSongData?.audio_url &&
                    versionSongData?.audio_generation_status !== 'generating' &&
                    versionSongData?.audio_generation_status !== 'completed') {

                  console.log(`Invoking generate-song-audio for version song ${targetSongId}`)

                  const { error: genError } = await supabase.functions.invoke('generate-song-audio', {
                    body: {
                      songId: targetSongId,
                      userId: versionSongData.user_id
                    }
                  })

                  if (genError) {
                    console.error(`Failed to trigger audio generation for version song ${targetSongId}:`, genError)
                  } else {
                    console.log(`✓ Audio generation triggered for version song ${targetSongId}`)
                  }
                }
              } catch (genTriggerError) {
                console.error(`Error triggering audio generation for version song ${targetSongId}:`, genTriggerError)
              }
            }
          } else {
            // Standard recording - update existing song as before
            const songUpdate: Record<string, unknown> = {
              quality_score: newQuality,
              status: 'recorded',
              updated_at: new Date().toISOString(),
            }
            
            // Also link song to band if recording session has band_id
            if (session.band_id) {
              songUpdate.band_id = session.band_id
            }
            
            const { error: songUpdateError } = await supabase
              .from('songs')
              .update(songUpdate)
              .eq('id', session.song_id)
              
            if (songUpdateError) {
              console.error(`Failed to update song ${session.song_id}:`, songUpdateError)
            } else {
              console.log(`Updated song ${session.song_id}: status=recorded, quality=${newQuality}, band_id=${session.band_id || 'unchanged'}`)
              
              // Automatically trigger AI song audio generation on recording completion
              try {
                console.log(`Song ${session.song_id} recorded (quality ${newQuality}), triggering auto audio generation...`)

                if (originalSong.user_id) {
                  const { data: songData } = await supabase
                    .from('songs')
                    .select('audio_url, audio_generation_status')
                    .eq('id', session.song_id)
                    .single()

                  if (!songData?.audio_url &&
                      songData?.audio_generation_status !== 'generating' &&
                      songData?.audio_generation_status !== 'completed') {

                    console.log(`Invoking generate-song-audio for song ${session.song_id}`)

                    const { error: genError } = await supabase.functions.invoke('generate-song-audio', {
                      body: {
                        songId: session.song_id,
                        userId: originalSong.user_id
                      }
                    })

                    if (genError) {
                      console.error(`Failed to trigger audio generation for song ${session.song_id}:`, genError)
                    } else {
                      console.log(`✓ Audio generation triggered for song ${session.song_id}`)
                    }
                  } else {
                    console.log(`Skipping audio generation for song ${session.song_id}: ` +
                      `has_audio=${!!songData?.audio_url}, status=${songData?.audio_generation_status}`)
                  }
                } else {
                  console.log(`Skipping audio generation for song ${session.song_id}: no user_id`)
                }
              } catch (genTriggerError) {
                console.error(`Error triggering audio generation for song ${session.song_id}:`, genTriggerError)
              }
            }
          }
        }

        // Award XP to band members or user
        if (session.band_id) {
          const { data: bandMembers } = await supabase
            .from('band_members')
            .select('user_id')
            .eq('band_id', session.band_id)
            .eq('member_status', 'active')

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
                      xp_awards: outcome.xpAwards,
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

        // === RECORDING SESSION → MORALE (v1.0.965) ===
        if (session.band_id && qualityImprovement > 0) {
          try {
            const { data: bMorale } = await supabase.from('bands').select('morale').eq('id', session.band_id).single();
            if (bMorale) {
              const moraleBoost = qualityImprovement >= 25 ? 5 : qualityImprovement >= 15 ? 3 : 1;
              const curM = (bMorale as any).morale ?? 50;
              const newMorale = Math.min(100, curM + moraleBoost);
              await supabase.from('bands').update({ morale: newMorale } as any).eq('id', session.band_id);
              console.log(`Recording morale boost: quality +${qualityImprovement} → morale +${moraleBoost}`);
              // === HEALTH EVENT LOG (v1.0.996) ===
              try {
                await supabase.from('band_health_events').insert({
                  band_id: session.band_id, event_type: 'morale', delta: moraleBoost, new_value: newMorale, source: 'recording_session', description: `Recording session: quality +${qualityImprovement} (${outcome.balanceVersion})`,
                });
              } catch (_logErr) { /* non-critical */ }
            }
          } catch (_e) { /* non-critical */ }
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
