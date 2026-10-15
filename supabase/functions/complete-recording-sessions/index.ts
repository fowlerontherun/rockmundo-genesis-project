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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const payload = await safeJson<{ triggeredBy?: string; requestId?: string | null; sessionId?: string; profileId?: string }>(req)
  const triggeredBy = payload?.triggeredBy ?? req.headers.get('x-triggered-by') ?? undefined
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const authorization = req.headers.get('authorization')
  const bearer = authorization?.replace(/^Bearer\s+/i, '').trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  let manuallyRequestedSessionId: string | null = null
  if (payload?.sessionId) {
    if (!bearer || !payload.profileId) {
      return new Response(JSON.stringify({ error: 'Authenticated character and session required' }), { status: 401, headers: corsHeaders })
    }
    const { data: auth, error: authError } = await supabase.auth.getUser(bearer)
    if (authError || !auth.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: corsHeaders })
    }
    const { data: owned, error: ownedError } = await supabase.from('recording_sessions')
      .select('id, scheduled_end, status, profile_id, user_id')
      .eq('id', payload.sessionId)
      .eq('profile_id', payload.profileId).maybeSingle()
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('id').eq('id', payload.profileId).eq('user_id', auth.user.id).maybeSingle()
    if (ownedError || profileError || !owned || !profile) {
      return new Response(JSON.stringify({ error: 'Recording not owned by active character' }), { status: 403, headers: corsHeaders })
    }
    if (!['scheduled', 'in_progress'].includes(owned.status) || !owned.scheduled_end ||
      Date.parse(owned.scheduled_end) > Date.now()) {
      return new Response(JSON.stringify({ error: 'Recording is not ready for completion' }), { status: 409, headers: corsHeaders })
    }
    manuallyRequestedSessionId = owned.id
  } else if (!serviceKey || bearer !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Global recording processing requires service authentication' }), { status: 403, headers: corsHeaders })
  }

  let runId: string | null = null
  const startedAt = Date.now()
  let completedCount = 0
  let errorCount = 0
  let totalXpAwarded = 0
  let averageFinalQuality = 0

  try {
    runId = await startJobRun({
      jobName: 'complete-recording-sessions',
      functionName: 'complete-recording-sessions',
      supabaseClient: supabase,
      triggeredBy,
      requestPayload: payload ?? null,
      requestId: payload?.requestId ?? null,
    })

    try {
      if (!manuallyRequestedSessionId) await supabase.rpc('auto_prepare_recording_travel')
    } catch (travelPrepError) {
      console.error('Recording travel preparation failed:', travelPrepError)
    }

    const nowIso = new Date().toISOString()
    let sessionsQuery = supabase
      .from('recording_sessions')
      .select('*')
      .in('status', ['in_progress', 'scheduled'])
      .lt('scheduled_end', nowIso)
    if (manuallyRequestedSessionId) sessionsQuery = sessionsQuery.eq('id', manuallyRequestedSessionId)
    const { data: rawSessions, error: sessionsError } = await sessionsQuery
    if (sessionsError) throw sessionsError

    const songIds = Array.from(new Set((rawSessions || []).map((s: any) => s.song_id).filter(Boolean)))
    const songMap = new Map<string, any>()
    if (songIds.length > 0) {
      const { data: songRows } = await supabase
        .from('songs')
        .select('id, quality_score, title, genre, lyrics, user_id, band_id, parent_song_id, version, duration_seconds, duration_display, songwriting_project_id')
        .in('id', songIds)
      for (const row of songRows || []) songMap.set((row as any).id, row)
    }
    const sessions = (rawSessions || []).map((s: any) => ({ ...s, songs: s.song_id ? songMap.get(s.song_id) || null : null }))

    for (const session of sessions) {
      try {
        const studioCityId = session.city_id || null
        let locationCityId = studioCityId
        if (!locationCityId && session.studio_id) {
          const { data: studioCity } = await supabase
            .from('city_studios')
            .select('city_id')
            .eq('id', session.studio_id)
            .maybeSingle()
          locationCityId = studioCity?.city_id || null
        }

        if (locationCityId) {
          const { data: expectedCity } = await supabase
            .from('cities')
            .select('id, name, country')
            .eq('id', locationCityId)
            .maybeSingle()
          const missingDetails: any[] = []

          if (session.band_id) {
            // Attendance is the booked participant snapshot, not whoever is
            // a band member at completion time. This excludes players whom the
            // band leader explicitly skipped due to scheduling conflicts.
            const { data: bookedParticipants, error: participantsError } = await supabase
              .from('player_scheduled_activities')
              .select('profile_id, user_id')
              .eq('linked_recording_id', session.id)
              .in('status', ['scheduled', 'in_progress', 'completed'])
            if (participantsError) throw participantsError
            const seenProfileIds = new Set<string>()
            const members = (bookedParticipants || []).filter((member: any) => {
              if (!member.profile_id || seenProfileIds.has(member.profile_id)) return false
              seenProfileIds.add(member.profile_id)
              return true
            })
            if (members.length === 0) {
              // Missing projection must be repaired, not turn a paid booking
              // into a false location failure based on later band membership.
              throw new Error('recording_booked_participants_missing')
            }

            const profileIds = (members || []).map((m: any) => m.profile_id).filter(Boolean)
            const { data: profiles, error: profileError } = profileIds.length
              ? await supabase
                  .from('profiles')
                  .select('id, user_id, display_name, username, current_city_id, is_traveling, travel_arrives_at')
                  .in('id', profileIds)
              : { data: [], error: null } as any
            if (profileError) throw profileError

            const cityIds = Array.from(new Set((profiles || []).map((p: any) => p.current_city_id).filter(Boolean)))
            const { data: currentCities } = cityIds.length
              ? await supabase.from('cities').select('id, name, country').in('id', cityIds)
              : { data: [] } as any
            const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))
            const cityMap = new Map((currentCities || []).map((c: any) => [c.id, c]))

            for (const member of members || []) {
              const profile = member.profile_id ? profileMap.get(member.profile_id) : null
              const currentCity = profile?.current_city_id ? cityMap.get(profile.current_city_id) : null
              if (!profile || profile.current_city_id !== locationCityId) {
                missingDetails.push({
                  profile_id: member.profile_id ?? null,
                  user_id: member.user_id ?? null,
                  name: profile?.display_name || profile?.username || 'Band member',
                  role: member.instrument_role || member.role || null,
                  current_city_id: profile?.current_city_id ?? null,
                  current_city_name: currentCity?.name ?? null,
                  current_country: currentCity?.country ?? null,
                  expected_city_id: locationCityId,
                  expected_city_name: expectedCity?.name ?? null,
                  expected_country: expectedCity?.country ?? null,
                  is_traveling: Boolean(profile?.is_traveling),
                  travel_arrives_at: profile?.travel_arrives_at ?? null,
                  reason: profile ? 'wrong_city' : 'profile_missing',
                })
              }
            }
          } else {
            let soloProfileId = session.profile_id || null
            if (!soloProfileId && session.user_id) {
              const { data: activeProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', session.user_id)
                .eq('is_active', true)
                .is('died_at', null)
                .maybeSingle()
              soloProfileId = activeProfile?.id || null
            }

            if (soloProfileId) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, user_id, display_name, username, current_city_id, is_traveling, travel_arrives_at')
                .eq('id', soloProfileId)
                .maybeSingle()
              if (profile && profile.current_city_id !== locationCityId) {
                const { data: currentCity } = profile.current_city_id
                  ? await supabase.from('cities').select('id, name, country').eq('id', profile.current_city_id).maybeSingle()
                  : { data: null } as any
                missingDetails.push({
                  profile_id: profile.id,
                  user_id: profile.user_id,
                  name: profile.display_name || profile.username || 'Player',
                  current_city_id: profile.current_city_id,
                  current_city_name: currentCity?.name ?? null,
                  current_country: currentCity?.country ?? null,
                  expected_city_id: locationCityId,
                  expected_city_name: expectedCity?.name ?? null,
                  expected_country: expectedCity?.country ?? null,
                  is_traveling: Boolean(profile.is_traveling),
                  travel_arrives_at: profile.travel_arrives_at ?? null,
                  reason: 'wrong_city',
                })
              }
            }
          }

          if (missingDetails.length > 0) {
            const expectedName = expectedCity?.name || 'the studio city'
            const memberText = missingDetails.map((m: any) => {
              if (m.is_traveling && m.travel_arrives_at) {
                return `${m.name} was still travelling (arrival ${new Date(m.travel_arrives_at).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC)`
              }
              return `${m.name} was in ${m.current_city_name || 'an unknown location'}`
            }).join('; ')
            const failureReason = `Recording could not complete because ${memberText}. Studio location: ${expectedName}.`

            const { error: failError } = await supabase
              .from('recording_sessions')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                session_data: {
                  ...(session.session_data || {}),
                  failure_code: 'member_location_mismatch',
                  failure_reason: failureReason,
                  expected_city_id: locationCityId,
                  expected_city_name: expectedCity?.name ?? null,
                  missing_members: missingDetails,
                },
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
          ? await supabase.from('city_studios').select('quality_rating, equipment_rating').eq('id', session.studio_id).maybeSingle()
          : { data: null } as any
        const { data: bandData } = session.band_id
          ? await supabase.from('bands').select('morale, reputation_score, fan_sentiment_score, chemistry, band_chemistry, cohesion').eq('id', session.band_id).maybeSingle()
          : { data: null } as any
        const { data: memberRows } = session.band_id
          ? await supabase.from('band_members').select('profile_id, user_id, instrument_role, role, member_status').eq('band_id', session.band_id).in('member_status', ['active'])
          : { data: [] } as any

        let soloProfileId = session.profile_id || null
        if (!session.band_id && !soloProfileId && session.user_id) {
          const { data: activeSoloProfile } = await supabase
            .from('profiles').select('id').eq('user_id', session.user_id).eq('is_active', true).is('died_at', null).maybeSingle()
          soloProfileId = activeSoloProfile?.id || null
        }
        const soloProfiles = !session.band_id
          ? [{ profile_id: soloProfileId, user_id: session.user_id, instrument_role: 'lead_vocals', role: 'lead_vocals' }]
          : []
        // Never attribute a bandmate's performance to the recording owner.
        // Some legacy memberships have only a user_id, so resolve that user's
        // current character instead of reusing the booking character.
        const resolvedBandMembers = await Promise.all((memberRows || []).map(async (member: any) => {
          if (member.profile_id) return member
          if (!member.user_id) throw new Error('recording_performer_profile_missing')
          const { data: performerProfile, error: performerError } = await supabase
            .from('profiles').select('id').eq('user_id', member.user_id)
            .eq('is_active', true).is('died_at', null).maybeSingle()
          if (performerError) throw performerError
          if (!performerProfile?.id) throw new Error('recording_performer_profile_missing')
          return { ...member, profile_id: performerProfile.id }
        }))
        const participants = [...resolvedBandMembers, ...soloProfiles]

        const performerInputs = await Promise.all(participants.map(async (member: any) => {
          const performerProfileId = member.profile_id
          const { data: profile } = performerProfileId
            ? await supabase.from('profiles').select('health, energy, motivation, physical_health').eq('id', performerProfileId).maybeSingle()
            : { data: null } as any
          const { data: skillRows } = performerProfileId
            ? await supabase.from('player_skills').select('skill_id, skill_slug, level').eq('profile_id', performerProfileId)
            : { data: [] } as any
          const skills = Object.fromEntries((skillRows || []).map((row: any) => [row.skill_slug || row.skill_id, row.level || 0]))
          const attrs = { physical_health: (profile as any)?.physical_health ?? (profile as any)?.health ?? 75 }
          return {
            profileId: performerProfileId || member.user_id || session.user_id,
            role: member.instrument_role || member.role || 'lead_vocals',
            accepted: true,
            attended: true,
            skills,
            attributes: attrs,
            songFamiliarity: 40,
            rehearsalReadiness: 40,
            health: (profile as any)?.health ?? 85,
            energy: (profile as any)?.energy ?? 85,
            focus: (profile as any)?.motivation ?? 75,
            equipmentQuality: 55,
            equipmentSuitability: 60,
          }
        }))

        // Player producer rows use a producer-profile ID, not a playable
        // character ID. Resolve a real active recipient for XP attribution.
        let producerCharacterId: string | null = null
        if (session.player_producer_id) {
          const { data: producerRow, error: producerLookupError } = await supabase
            .from('player_producer_profiles').select('user_id')
            .eq('id', session.player_producer_id).maybeSingle()
          if (producerLookupError) throw producerLookupError
          if (producerRow?.user_id) {
            const { data: producerCharacter, error: producerProfileError } = await supabase
              .from('profiles').select('id').eq('user_id', producerRow.user_id)
              .eq('is_active', true).is('died_at', null).maybeSingle()
            if (producerProfileError) throw producerProfileError
            producerCharacterId = producerCharacter?.id || null
          }
        }

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
            ? { id: producerCharacterId, kind: producerCharacterId ? 'player' : 'npc', rating: 55 }
            : session.producer_id ? { id: session.producer_id, kind: 'npc', rating: 60 } : null,
          sessionMode: session.recording_type || session.session_data?.sessionMode || 'professional',
          effortHours: durationHours,
          bandCohesion: (bandData as any)?.cohesion ?? (bandData as any)?.band_chemistry ?? (bandData as any)?.chemistry ?? 50,
          chemistry: (bandData as any)?.chemistry ?? (bandData as any)?.band_chemistry ?? 50,
          // Retry-safe: updated_at changes during the recording workflow.
          seed: `${session.id}:${session.scheduled_end}`,
        })

        const qualityImprovement = outcome.qualityImprovement
        const newQuality = outcome.finalMasterQuality

        const { error: updateError } = await supabase
          .from('recording_sessions')
          .update({
            // Keep the session processable until the song and reward stages succeed.
            status: 'in_progress',
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
        if (updateError) throw updateError

        if (session.song_id && session.songs) {
          const originalSong = session.songs
          const recordingVersion = session.recording_version || 'standard'
          if (recordingVersion !== 'standard') {
            // If an earlier attempt already linked this session to its child
            // version, update that version directly instead of nesting children.
            const parentSongId = originalSong.parent_song_id || session.song_id
            const { data: existingVersion, error: lookupError } =
              originalSong.parent_song_id && originalSong.version === recordingVersion
                ? { data: { id: session.song_id }, error: null }
                : await supabase.from('songs').select('id')
                  .eq('parent_song_id', parentSongId).eq('version', recordingVersion).maybeSingle()
            if (lookupError) throw lookupError
            let targetSongId = session.song_id
            if (existingVersion) {
              targetSongId = existingVersion.id
              const { error: versionUpdateError } = await supabase.from('songs')
                .update({ quality_score: newQuality, status: 'recorded', updated_at: new Date().toISOString(),
                  ...(recordingVersion === 'acoustic' ? { genre: 'acoustic' } : {}) })
                .eq('id', existingVersion.id)
              if (versionUpdateError) throw versionUpdateError
            } else {
              const versionLabel = recordingVersion === 'acoustic' ? 'Acoustic' : 'Remix'
              const { data: newSong, error: createError } = await supabase
                .from('songs')
                .insert({
                  user_id: originalSong.user_id,
                  band_id: session.band_id || originalSong.band_id,
                  title: `${originalSong.title} (${versionLabel})`,
                  // Acoustic is a genre of this take only; never alter the parent composition.
                  genre: recordingVersion === 'acoustic' ? 'acoustic' : originalSong.genre,
                  lyrics: originalSong.lyrics,
                  quality_score: newQuality,
                  status: 'recorded',
                  parent_song_id: parentSongId,
                  version: recordingVersion,
                  duration_seconds: originalSong.duration_seconds,
                  duration_display: originalSong.duration_display,
                  songwriting_project_id: originalSong.songwriting_project_id,
                })
                .select('id').single()
              if (createError) throw createError
              if (!newSong?.id) throw new Error('Recording version was not returned after insert')
              targetSongId = newSong.id
            }
            // Always repair the session's link, including retries where the
            // child insert previously committed but linkage failed.
            if (targetSongId !== session.song_id) {
              const { error: linkError } = await supabase.from('recording_sessions')
                .update({ song_id: targetSongId }).eq('id', session.id)
              if (linkError) throw linkError
            }
            if (targetSongId) {
              try {
                const { data: versionSongData } = await supabase
                  .from('songs').select('user_id, audio_url, audio_generation_status').eq('id', targetSongId).single()
                if (versionSongData?.user_id && !versionSongData.audio_url && !['generating','completed'].includes(versionSongData.audio_generation_status)) {
                  await supabase.functions.invoke('generate-song-audio', { body: { songId: targetSongId, userId: versionSongData.user_id } })
                }
              } catch (e) { console.error('Version audio generation error:', e) }
            }
          } else {
            const songUpdate: Record<string, unknown> = { quality_score: newQuality, status: 'recorded', updated_at: new Date().toISOString() }
            if (session.band_id) songUpdate.band_id = session.band_id
            const { error: songUpdateError } = await supabase.from('songs').update(songUpdate).eq('id', session.song_id)
            if (songUpdateError) throw songUpdateError
            if (!songUpdateError) {
              try {
                const { data: songData } = await supabase.from('songs').select('audio_url, audio_generation_status').eq('id', session.song_id).single()
                if (originalSong.user_id && !songData?.audio_url && !['generating','completed'].includes(songData?.audio_generation_status)) {
                  await supabase.functions.invoke('generate-song-audio', { body: { songId: session.song_id, userId: originalSong.user_id } })
                }
              } catch (e) { console.error('Audio generation trigger error:', e) }
            }
          }
        }

        // #4108/#4117: the trusted outcome's per-profile/per-skill awards
        // are granted once in a single transaction. This RPC reads stored
        // xp_awards: no caller may submit an arbitrary amount. An RPC error
        // MUST stop completion so that a later worker run can safely retry.
        const { data: awardResult, error: awardError } = await supabase
          .rpc('award_recording_xp_atomic', { p_session_id: session.id })
        if (awardError) throw new Error(`recording_xp_award_failed: ${awardError.message}`)
        if (!awardResult || !Number.isFinite(Number(awardResult.awarded_xp))) {
          throw new Error('recording_xp_award_missing_confirmation')
        }
        const xpEarned = Number(awardResult.awarded_xp)

        if (session.band_id && qualityImprovement > 0) {
          try {
            const { data: bMorale } = await supabase.from('bands').select('morale').eq('id', session.band_id).single()
            if (bMorale) {
              const moraleBoost = qualityImprovement >= 25 ? 5 : qualityImprovement >= 15 ? 3 : 1
              const newMorale = Math.min(100, ((bMorale as any).morale ?? 50) + moraleBoost)
              await supabase.from('bands').update({ morale: newMorale } as any).eq('id', session.band_id)
              try {
                await supabase.from('band_health_events').insert({
                  band_id: session.band_id, event_type: 'morale', delta: moraleBoost, new_value: newMorale,
                  source: 'recording_session', description: `Recording session: quality +${qualityImprovement} (${outcome.balanceVersion})`,
                })
              } catch (_) {}
            }
          } catch (_) {}
        }

        const { error: completionError } = await supabase.from('recording_sessions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', session.id)
          .eq('status', 'in_progress')
        if (completionError) throw completionError

        completedCount++
        totalXpAwarded += xpEarned
        averageFinalQuality += newQuality
      } catch (error) {
        errorCount += 1
        console.error(`Error processing session ${session.id}:`, error)
      }
    }

    if (completedCount > 0) averageFinalQuality = Math.round((averageFinalQuality / completedCount) * 10) / 10

    try {
      const { data: strandedSongs } = await supabase
        .from('songs')
        .select('id, user_id, audio_generation_status, audio_generation_started_at')
        .eq('status', 'recorded').is('audio_url', null).not('user_id', 'is', null).limit(25)
      if (strandedSongs?.length) {
        const tenMinAgo = Date.now() - 10 * 60 * 1000
        for (const song of strandedSongs.filter((s: any) => s.audio_generation_status !== 'completed' && (s.audio_generation_status !== 'generating' || new Date(s.audio_generation_started_at || 0).getTime() < tenMinAgo))) {
          try { await supabase.functions.invoke('generate-song-audio', { body: { songId: song.id, userId: song.user_id } }) } catch (_) {}
        }
      }
    } catch (_) {}

    await completeJobRun({
      jobName: 'complete-recording-sessions', runId, supabaseClient: supabase,
      durationMs: Date.now() - startedAt, processedCount: completedCount, errorCount,
      resultSummary: { completedCount, totalXpAwarded, averageFinalQuality, errorCount },
    })

    return new Response(JSON.stringify({ success: true, completedSessions: completedCount, errors: errorCount, totalXpAwarded, averageFinalQuality }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    await failJobRun({
      jobName: 'complete-recording-sessions', runId, supabaseClient: supabase,
      durationMs: Date.now() - startedAt, error,
      resultSummary: { completedCount, errorCount, totalXpAwarded, averageFinalQuality },
    })
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
