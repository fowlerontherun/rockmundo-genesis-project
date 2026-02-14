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
      .select('*, songs(id, quality_score, title, genre, lyrics, user_id, band_id, duration_seconds, duration_display, songwriting_project_id)')
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
            // Band session: check all active members
            const { data: members } = await supabase
              .from('band_members')
              .select('user_id, current_city_id')
              .eq('band_id', session.band_id)
              .in('member_status', ['active'])
              .eq('is_touring_member', false)

            missingMembers = (members || [])
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

        // Recording session luck roll - adds more variance to outcomes
        const sessionRoll = Math.random()
        let sessionLuckMultiplier = 1.0
        let sessionLuckLabel = 'normal'
        if (sessionRoll < 0.08) {
          // 8% - Technical issues (bad takes, equipment problems)
          sessionLuckMultiplier = 0.4 + Math.random() * 0.3 // 0.4-0.7x
          sessionLuckLabel = 'technical_issues'
        } else if (sessionRoll < 0.18) {
          // 10% - Rough session
          sessionLuckMultiplier = 0.7 + Math.random() * 0.2 // 0.7-0.9x
          sessionLuckLabel = 'rough_session'
        } else if (sessionRoll > 0.92) {
          // 8% - Magic take (everything clicks perfectly)
          sessionLuckMultiplier = 1.6 + Math.random() * 0.4 // 1.6-2.0x
          sessionLuckLabel = 'magic_take'
        } else if (sessionRoll > 0.82) {
          // 10% - Great flow
          sessionLuckMultiplier = 1.2 + Math.random() * 0.3 // 1.2-1.5x
          sessionLuckLabel = 'great_flow'
        }

        // Base improvement scales with duration (1-12 per hour for wider range)
        const baseImprovement = Math.floor(durationHours * (1 + Math.random() * 11))
        
        // Apply luck multiplier and studio bonus
        const qualityImprovement = Math.min(40, Math.floor(baseImprovement * sessionLuckMultiplier) + studioQualityBonus)
        
        // Calculate new quality (capped at 100)
        const newQuality = Math.min(100, currentQuality + qualityImprovement)
        
        console.log(`Recording luck: ${sessionLuckLabel} (${sessionLuckMultiplier.toFixed(2)}x)`)

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
            
            // Trigger audio generation for the version song if quality is good enough
            if (newQuality >= 60 && targetSongId) {
              try {
                const { data: versionSongData } = await supabase
                  .from('songs')
                  .select('user_id, audio_url, audio_generation_status, songwriting_project_id')
                  .eq('id', targetSongId)
                  .single()
                
                if (versionSongData?.user_id && 
                    !versionSongData?.audio_url && 
                    versionSongData?.audio_generation_status !== 'generating' &&
                    versionSongData?.audio_generation_status !== 'completed' &&
                    versionSongData?.songwriting_project_id) {
                  
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
              
              // Trigger auto song audio generation if quality is good enough (≥60)
              if (newQuality >= 60) {
                try {
                  console.log(`Song ${session.song_id} quality ${newQuality} >= 60, triggering auto audio generation...`)
                  
                  if (originalSong.user_id && originalSong.songwriting_project_id) {
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
                    console.log(`Skipping audio generation for song ${session.song_id}: ` +
                      `has_user=${!!originalSong.user_id}, has_project=${!!originalSong.songwriting_project_id}`)
                  }
                } catch (genTriggerError) {
                  console.error(`Error triggering audio generation for song ${session.song_id}:`, genTriggerError)
                }
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
