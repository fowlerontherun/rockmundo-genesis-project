import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'
import {
  completeJobRun,
  failJobRun,
  getErrorMessage,
  safeJson,
  startJobRun,
} from '../_shared/job-logger.ts'
import { calculateRecordingOutcome } from '../_shared/recordingOutcomeCalculator.ts'
import { applyRecordingQualityBoost, selectRecordingQualityBoost } from '../_shared/recordingUnderworldBoost.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-triggered-by, x-cron-secret',
}

// Automatic recording audio is strictly a first-attempt convenience, never a
// retry policy. Failed provider predictions may incur charges, even when our
// webhook rejects their duration or Replicate throttles later requests.
async function requestInitialSongAudio(supabase: ReturnType<typeof createClient>, songId: string, userId: string) {
  const { data: previousAttempts, error: historyError } = await supabase
    .from('song_generation_attempts').select('id').eq('song_id', songId).limit(1)
  if (historyError) throw new Error(`Audio attempt history unavailable: ${historyError.message}`)
  if (previousAttempts?.length) {
    console.log(`[complete-recording-sessions] Skipped automatic re-generation for ${songId}: prior attempt exists`)
    return
  }
  const { error } = await supabase.functions.invoke('generate-song-audio', {
    body: { songId, userId },
  })
  if (error) throw error
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
  } else {
    // Automated work is authorized with the secret already stored in Vault;
    // the service-role client checks it through the protected server-side RPC.
    // Never accept an anonymous JWT as permission to process every session.
    const cronSecret = req.headers.get('x-cron-secret')
    let cronAuthorized = false
    if (cronSecret && cronSecret.length >= 32) {
      const { data, error } = await supabase.rpc('verify_internal_cron_secret', { p_secret: cronSecret })
      cronAuthorized = !error && data === true
    }
    if (!serviceKey || (bearer !== serviceKey && !cronAuthorized)) {
      return new Response(JSON.stringify({ error: 'Global recording processing requires service authentication' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
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
        .select('id, quality_score, title, genre, lyrics, user_id, profile_id, band_id, parent_song_id, source_recording_session_id, version, duration_seconds, duration_display, songwriting_project_id')
        .in('id', songIds)
      for (const row of songRows || []) songMap.set((row as any).id, row)
    }
    const sessions = (rawSessions || []).map((s: any) => ({ ...s, songs: s.song_id ? songMap.get(s.song_id) || null : null }))

    for (const session of sessions) {
      let completionClaimId: string | null = null
      try {
        // #4107: only one cron/manual worker can own this session's lease.
        const { data: claimId, error: claimError } = await supabase.rpc(
          'claim_recording_completion', { p_session_id: session.id })
        if (claimError) throw claimError
        if (!claimId) continue
        completionClaimId = claimId

        // #4104: read booked attendance exactly once and use the same
        // participant snapshot for location AND performance/XP calculations.
        let bookedParticipants: any[] = []
        if (session.band_id) {
          const { data: rows, error: bookedError } = await supabase
            .from('player_scheduled_activities')
            .select('profile_id, user_id')
            .eq('linked_recording_id', session.id)
            .in('status', ['scheduled', 'in_progress', 'completed'])
          if (bookedError) throw bookedError
          const seenProfiles = new Set<string>()
          bookedParticipants = (rows || []).filter((row: any) => {
            if (!row.profile_id || seenProfiles.has(row.profile_id)) return false
            seenProfiles.add(row.profile_id)
            return true
          })
          if (!bookedParticipants.length) throw new Error('recording_booked_participants_missing')
        }

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
            const members = bookedParticipants

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
              .eq('completion_claim_id', completionClaimId)
            if (failError) throw failError
            errorCount++
            continue
          }
        }

        const startTime = new Date(session.scheduled_start)
        const endTime = new Date(session.scheduled_end)
        const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
        // A retried session must not feed its previously-updated master back
        // into the next quality calculation.
        const currentQuality = session.source_song_quality ?? session.songs?.quality_score ?? 50

        const { data: studioData } = session.studio_id
          ? await supabase.from('city_studios').select('quality_rating, equipment_rating').eq('id', session.studio_id).maybeSingle()
          : { data: null } as any
        const { data: bandData } = session.band_id
          ? await supabase.from('bands').select('morale, reputation_score, fan_sentiment_score, chemistry, band_chemistry, cohesion').eq('id', session.band_id).maybeSingle()
          : { data: null } as any
        const { data: memberRows, error: memberRowsError } = session.band_id
          ? await supabase.from('band_members')
              .select('profile_id, user_id, instrument_role, role, member_status')
              .eq('band_id', session.band_id)
          : { data: [], error: null } as any
        if (memberRowsError) throw memberRowsError

        let soloProfileId = session.profile_id || null
        if (!session.band_id && !soloProfileId && session.user_id) {
          const { data: activeSoloProfile } = await supabase
            .from('profiles').select('id').eq('user_id', session.user_id).eq('is_active', true).is('died_at', null).maybeSingle()
          soloProfileId = activeSoloProfile?.id || null
        }
        const soloProfiles = !session.band_id
          ? [{ profile_id: soloProfileId, user_id: session.user_id, instrument_role: 'lead_vocals', role: 'lead_vocals' }]
          : []
        // Each performer is precisely who was booked, even if a member has
        // since joined/left the band or was explicitly skipped at checkout.
        const membershipByProfile = new Map((memberRows || [])
          .filter((row: any) => row.profile_id)
          .map((row: any) => [row.profile_id, row]))
        const participants = session.band_id
          ? bookedParticipants.map((booked: any) => ({
              ...(membershipByProfile.get(booked.profile_id) || {}),
              profile_id: booked.profile_id,
              user_id: booked.user_id,
            }))
          : soloProfiles

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

        // Only booked performers may contribute a previously paid, time-valid
        // recording boost. The scheduled end (not delayed cron execution)
        // determines eligibility; the strongest single boost applies.
        // Re-verify source, ownership and validity on every retry. Persisted
        // outcome_breakdown is diagnostic, never an authority to award a boost.
        let recordingBoost: { percent: number; purchaseId: string } | null = null
        if (!recordingBoost) {
          const bookedIds = [...new Set(participants
            .map((member: any) => member.profile_id)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
          if (bookedIds.length > 0) {
            const { data: boosts, error: boostsError } = await supabase
              .from('player_active_boosts')
              .select('profile_id,source_purchase_id,boost_type,boost_value,started_at,expires_at,is_active')
              .in('profile_id', bookedIds)
              .eq('boost_type', 'recording_quality_boost')
              .eq('is_active', true)
              .lte('started_at', session.scheduled_end)
              .gt('expires_at', session.scheduled_end)
              .not('source_purchase_id', 'is', null)
            if (boostsError) throw new Error(`recording_boost_lookup_failed: ${boostsError.message}`)
            recordingBoost = selectRecordingQualityBoost(
              (boosts || []) as any, new Set(bookedIds), session.scheduled_end,
            )
          }
        }
        // Equipped-outfit recording bonus (e.g. Cool Britannia '96): average of
        // booked performers' equipped clothing recording_pct, capped at 10%.
        let outfitRecordingPct = 0
        try {
          const performerIds = [...new Set(participants
            .map((member: any) => member.profile_id)
            .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))]
          if (performerIds.length > 0) {
            const pcts = await Promise.all(performerIds.map(async (pid) => {
              const { data } = await supabase.rpc('get_equipped_clothing_bonuses', { p_profile_id: pid })
              const row = Array.isArray(data) ? data[0] : data
              return Math.max(0, Number((row as any)?.recording_pct ?? 0))
            }))
            outfitRecordingPct = Math.min(10, pcts.reduce((a, b) => a + b, 0) / performerIds.length)
          }
        } catch (outfitError) {
          console.warn('[complete-recording-sessions] outfit recording bonus unavailable:', outfitError)
        }
        const combinedRecordingPct = Math.min(50, Math.round((recordingBoost?.percent ?? 0) + outfitRecordingPct))
        const newQuality = applyRecordingQualityBoost(outcome.finalMasterQuality, combinedRecordingPct)
        const qualityImprovement = Math.round(newQuality - outcome.sourceSongQuality)
        const outcomeBreakdown = {
          ...outcome.breakdown,
          ...(recordingBoost ? { underworldRecordingBoost: {
            percent: recordingBoost.percent,
            purchaseId: recordingBoost.purchaseId,
            appliedToFinalMaster: true,
          } } : {}),
        }

        const { data: updatedSession, error: updateError } = await supabase
          .from('recording_sessions')
          .update({
            // Keep the session processable until the song and reward stages succeed.
            status: 'in_progress',
            quality_improvement: qualityImprovement,
            calculation_version: outcome.balanceVersion,
            source_song_quality: outcome.sourceSongQuality,
            final_master_quality: newQuality,
            applied_variance: outcome.appliedVariance,
            outcome_breakdown: outcomeBreakdown,
            xp_awards: outcome.xpAwards,
            recording_credits: (outcome.breakdown as any).performerBreakdowns || [],
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)
          .eq('completion_claim_id', completionClaimId)
          .select('id').maybeSingle()
        if (updateError) throw updateError
        if (!updatedSession?.id) throw new Error('recording_completion_claim_lost')

        if (session.song_id && session.songs) {
          const originalSong = session.songs
          const recordingVersion = session.recording_version || 'standard'
          if (recordingVersion !== 'standard') {
            // #4114: one immutable acoustic/remix song per *recording*.
            // Earlier takes and any audio already used on releases remain intact.
            // Retries find this session's own child rather than a prior take.
            const parentSongId = originalSong.parent_song_id || session.song_id
            const { data: existingTake, error: takeLookupError } =
              originalSong.source_recording_session_id === session.id
                ? { data: { id: session.song_id }, error: null }
                : await supabase.from('songs').select('id')
                    .eq('source_recording_session_id', session.id).maybeSingle()
            if (takeLookupError) throw takeLookupError
            let targetSongId = existingTake?.id || session.song_id
            if (!existingTake) {
              const versionLabel = recordingVersion === 'acoustic' ? 'Acoustic' : 'Remix'
              const { data: newSong, error: createError } = await supabase
                .from('songs')
                .insert({
                  user_id: originalSong.user_id,
                  profile_id: originalSong.profile_id,
                  band_id: session.band_id || originalSong.band_id,
                  // Stable session suffix avoids ambiguous versions in libraries.
                  title: `${originalSong.title} (${versionLabel} Take ${session.id.slice(0, 8)})`,
                  genre: recordingVersion === 'acoustic' ? 'acoustic' : originalSong.genre,
                  lyrics: originalSong.lyrics,
                  quality_score: newQuality,
                  status: 'recorded',
                  parent_song_id: parentSongId,
                  source_recording_session_id: session.id,
                  version: recordingVersion,
                  duration_seconds: originalSong.duration_seconds,
                  duration_display: originalSong.duration_display,
                  songwriting_project_id: originalSong.songwriting_project_id,
                })
                .select('id').single()
              if (createError) throw createError
              if (!newSong?.id) throw new Error('Recording take not returned after insert')
              targetSongId = newSong.id
            }
            if (targetSongId !== session.song_id) {
              const { data: linked, error: linkError } = await supabase
                .from('recording_sessions')
                .update({ song_id: targetSongId })
                .eq('id', session.id)
                .eq('completion_claim_id', completionClaimId)
                .select('id').maybeSingle()
              if (linkError) throw linkError
              if (!linked?.id) throw new Error('recording_completion_claim_lost')
            }
            if (targetSongId) {
              try {
                const { data: versionSongData } = await supabase
                  .from('songs').select('user_id, audio_url, audio_generation_status').eq('id', targetSongId).single()
                if (versionSongData?.user_id && !versionSongData.audio_url && !['generating','completed'].includes(versionSongData.audio_generation_status)) {
                  await requestInitialSongAudio(supabase, targetSongId, versionSongData.user_id)
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
                  await requestInitialSongAudio(supabase, session.song_id, originalSong.user_id)
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

        // The finalization RPC holds a row lock, checks this lease, and applies
        // morale + completed status together exactly once.
        const { data: finalized, error: completionError } = await supabase.rpc(
          'finalize_recording_completion',
          { p_session_id: session.id, p_claim_id: completionClaimId },
        )
        if (completionError) throw completionError
        if (finalized !== true) throw new Error('recording_completion_claim_lost')

        completedCount++
        totalXpAwarded += xpEarned
        averageFinalQuality += newQuality
      } catch (error) {
        errorCount += 1
        console.error(`Error processing session ${session.id}:`, error)
        if (completionClaimId) {
          const { error: releaseError } = await supabase.rpc(
            'release_recording_completion',
            { p_session_id: session.id, p_claim_id: completionClaimId },
          )
          if (releaseError) console.error('Recording claim release failed:', releaseError)
        }
      }
    }

    if (completedCount > 0) averageFinalQuality = Math.round((averageFinalQuality / completedCount) * 10) / 10

    // Never sweep recorded songs for missing audio here: it caused repeated
    // provider calls every five minutes after earlier generations had failed.
    // Recovery is an explicit player/admin operation, not a background retry.

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
