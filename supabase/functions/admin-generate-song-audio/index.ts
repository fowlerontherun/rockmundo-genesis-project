import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signReplicateAttempt } from "../_shared/replicateWebhookAuth.ts"
import { normalizeMiniMaxStylePrompt } from "../_shared/musicStylePrompt.ts"


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let activeAttemptId: string | null = null
  let activeSongId: string | null = null
  const logs: string[] = []
  const addLog = (message: string) => {
    logs.push(`[${new Date().toISOString()}] ${message}`)
    console.log(`[admin-generate-song-audio] ${message}`)
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify admin role from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', { _user_id: user.id })
    
    if (roleError || roleData !== 'admin') {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const songId = url.searchParams.get('songId')
      const attemptId = url.searchParams.get('attemptId')
      if (!songId || !attemptId) return new Response(JSON.stringify({error:'songId and attemptId are required'}),{
        status:400,headers:{...corsHeaders,'Content-Type':'application/json'}
      })
      const {data: attempt,error: attemptError} = await supabase.from('song_generation_attempts')
        .select('id,status,error_message,prediction_id,started_at,completed_at').eq('id',attemptId).eq('song_id',songId).maybeSingle()
      if (attemptError) throw attemptError
      if (!attempt) return new Response(JSON.stringify({error:'Attempt not found'}),{
        status:404,headers:{...corsHeaders,'Content-Type':'application/json'}
      })
      const {data: song,error: songError} = await supabase.from('songs')
        .select('audio_url,audio_generation_status').eq('id',songId).single()
      if (songError) throw songError
      return new Response(JSON.stringify({
        attemptId:attempt.id,status:attempt.status,error:attempt.error_message,
        predictionId:attempt.prediction_id,songStatus:song.audio_generation_status,
        audioUrl:attempt.status==='completed'?song.audio_url:null,
        startedAt:attempt.started_at,completedAt:attempt.completed_at
      }),{headers:{...corsHeaders,'Content-Type':'application/json'}})
    }

    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    if (!REPLICATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'REPLICATE_API_KEY is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const { songId, customPrompt, musicModel, overrideLyrics } = await req.json()
    // Only the authenticated admin may explicitly opt in to the higher-cost model.
    const generationModel = musicModel === 'music-2.6' ? 'music-2.6' : 'music-1.5'
    addLog(`Selected music model: ${generationModel}`)

    if (!songId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: songId" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    addLog(`Starting MiniMax ${generationModel} generation for song ${songId} by admin ${user.id}`)

    // Get comprehensive song details with all metadata
    addLog('Fetching comprehensive song details from database...')
    
    // First get the song
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single()
    
    if (songError || !song) {
      addLog(`ERROR: Song fetch failed - ${songError?.message || 'Song not found'}`)
      console.error('[admin-generate-song-audio] Song fetch error:', songError)
      return new Response(
        JSON.stringify({ error: 'Song not found', logs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    activeSongId = songId

    // Race condition guard: prevent duplicate generation attempts (admins can override after 15 mins)
    if (song.audio_generation_status === 'generating') {
      const startedAt = song.audio_generation_started_at 
        ? new Date(song.audio_generation_started_at) 
        : new Date()
      const elapsed = Date.now() - startedAt.getTime()
      
      if (elapsed < 15 * 60 * 1000) {
        addLog(`WARNING: Generation already in progress, started ${Math.round(elapsed / 1000)}s ago`)
        return new Response(
          JSON.stringify({ 
            error: "Generation already in progress", 
            startedAt: song.audio_generation_started_at,
            message: "Please wait for the current generation to complete or wait 15 minutes to retry",
            logs
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }
      addLog(`Previous generation appears stuck (${Math.round(elapsed / 60000)} mins); an operator must reconcile its attempt before restarting`)
      return new Response(JSON.stringify({ error: "Existing generation must be reconciled first", code: "GENERATION_IN_PROGRESS", logs }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    // Admins use the same song-row claim as players. Only an authenticated
    // admin edge request may set the quota override on this service-role RPC.
    const { data: reservation, error: reservationError } = await supabase.rpc(
      "reserve_song_generation_atomic",
      { p_song_id: songId, p_user_id: song.user_id || user.id,
        p_actor_user_id: user.id, p_admin_override: true, p_replace_existing: true },
    )
    if (reservationError) throw new Error(`Could not create generation attempt: ${reservationError.message}`)
    if (!reservation?.ok) {
      return new Response(JSON.stringify({ error: "Generation is already running or unavailable",
        code: reservation?.code, logs }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const attempt = { id: reservation.attempt_id as string }
    activeAttemptId = attempt.id
    addLog(`Atomic generation reservation: ${attempt.id}`)

    // Then get the songwriting project if it exists
    let project: any = null
    if (song.songwriting_project_id) {
      const { data: projectData } = await supabase
        .from('songwriting_projects')
        .select(`
          title,
          lyrics,
          creative_brief,
          genres,
          chord_progression_id,
          theme_id,
          quality_score,
          chord_progressions (
            name,
            progression
          ),
          song_themes (
            name,
            mood,
            description
          )
        `)
        .eq('id', song.songwriting_project_id)
        .single()
      project = projectData
    }

    addLog(`Found song: "${song.title}" (Genre: ${song.genre || 'not set'}, Quality: ${song.quality_score || 'not set'})`)

    // Get creator's gender for vocal style
    let creatorGender: string | null = null
    if (song.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender')
        .eq('user_id', song.user_id)
        .single()
      creatorGender = profile?.gender || null
      addLog(`Creator gender: ${creatorGender || 'not set'}`)
    }

    // The reservation transaction has already updated the song status.

    // Extract creative brief from project
    const creativeBrief = project?.creative_brief as Record<string, any> || {}
    
    // Build comprehensive prompt for MiniMax Music-1.5
    const rawSongTitle = project?.title || song.title || 'Untitled'
    const cleanedSongTitle = cleanProfanity(rawSongTitle)
    const originalGenre = (song.genre || project?.genres?.[0] || 'pop').replace(/^Style:\s*/i, '').trim()
    const primaryGenre = String(song.version || "").toLowerCase() === "acoustic" ? "acoustic" : originalGenre
    const chordProgression = project?.chord_progressions?.progression || null
    const chordName = project?.chord_progressions?.name || null
    const themeName = project?.song_themes?.name || null
    const themeMood = project?.song_themes?.mood || null
    const themeDescription = project?.song_themes?.description || null
    // Smart lyrics selection: prefer non-AI lyrics, check project first if song has AI-generated ones
    // Track originals to avoid overwriting user-written lyrics
    const originalSongLyrics = song.lyrics
    const originalProjectLyrics = project?.lyrics
    const songLyricsAreAI = originalSongLyrics?.trim()?.startsWith('[AI Generated]') || originalSongLyrics?.trim()?.includes('[AI Generated]')
    const projectLyricsAreAI = originalProjectLyrics?.trim()?.startsWith('[AI Generated]') || originalProjectLyrics?.trim()?.includes('[AI Generated]')
    
    // An explicit admin edit must win over songwriting-project lyrics.
    // Saving directly from the browser can fail RLS and the project-lyrics
    // preference would otherwise silently ignore the edited song lyrics.
    let rawLyrics: string | null = null
    if (overrideLyrics !== undefined) {
      if (typeof overrideLyrics !== 'string') {
        throw new Error('overrideLyrics must be a string')
      }
      const editedLyrics = overrideLyrics.trim()
      if (editedLyrics.length < 10) {
        throw new Error('Edited lyrics must contain at least 10 characters')
      }
      rawLyrics = sanitizeLyrics(editedLyrics)
      if (!rawLyrics || rawLyrics.length < 10) {
        throw new Error('Edited lyrics could not be parsed; use a Verse or Chorus section')
      }
      const { error: saveLyricsError } = await supabase.from('songs')
        .update({ lyrics: editedLyrics }).eq('id', songId)
      if (saveLyricsError) throw new Error(`Could not save edited lyrics: ${saveLyricsError.message}`)
      addLog(`Saved admin-edited lyrics (${editedLyrics.length} chars); overriding project lyrics for this generation`)
    } else if (originalProjectLyrics?.trim() && !projectLyricsAreAI) {
      rawLyrics = sanitizeLyrics(originalProjectLyrics)
      addLog('Using non-AI project lyrics (preferred source)')
    } else if (originalSongLyrics?.trim() && !songLyricsAreAI) {
      rawLyrics = sanitizeLyrics(originalSongLyrics)
      addLog('Using non-AI song lyrics')
    } else if (originalSongLyrics?.trim()) {
      // Strip [AI Generated] prefix and use the actual lyrics content
      rawLyrics = sanitizeLyrics(originalSongLyrics.replace(/\[AI Generated\]\s*/g, '').trim()) 
      addLog('Using AI-tagged song lyrics (stripped [AI Generated] prefix)')
    } else if (originalProjectLyrics?.trim()) {
      rawLyrics = sanitizeLyrics(originalProjectLyrics.replace(/\[AI Generated\]\s*/g, '').trim())
      addLog('Using AI-tagged project lyrics (stripped [AI Generated] prefix)')
    }
    const hadOriginalLyrics = !!(originalSongLyrics?.trim() || originalProjectLyrics?.trim())
    const quality = song.quality_score || project?.quality_score || 50
    const durationSeconds = song.duration_seconds || 180
    const maxModelDurationSeconds = generationModel === 'music-2.6' ? 360 : 240
    if (durationSeconds * 0.8 > maxModelDurationSeconds) {
      throw new Error(`Song requires at least ${Math.ceil(durationSeconds * 0.8)} seconds, but ${generationModel} supports at most ${maxModelDurationSeconds} seconds. Select Music 2.6 or shorten the expected duration before paying for generation.`)
    }

    // Extract from creative_brief if available
    const inspirationAnchor = creativeBrief?.inspirationAnchor || creativeBrief?.inspiration_anchor || null
    const moodPalette = creativeBrief?.moodPalette || creativeBrief?.mood_palette || []

    addLog(`Song metadata extracted:`)
    addLog(`  - Title: ${cleanedSongTitle}${rawSongTitle !== cleanedSongTitle ? ' (cleaned)' : ''}`)
    addLog(`  - Genre: ${primaryGenre}`)
    addLog(`  - Chord Progression: ${chordProgression || 'None'}`)
    addLog(`  - Theme: ${themeName || 'None'} (${themeMood || 'N/A'})`)
    addLog(`  - Inspiration: ${inspirationAnchor || 'None'}`)
    addLog(`  - Mood Palette: ${Array.isArray(moodPalette) && moodPalette.length > 0 ? moodPalette.join(', ') : 'None'}`)
    addLog(`  - Initial Lyrics: ${rawLyrics ? rawLyrics.length + ' chars' : 'NONE'}`)
    addLog(`  - Quality Score: ${quality}`)
    addLog(`  - Duration: ${durationSeconds}s`)

    // AUTO-GENERATE LYRICS if missing - ensures every song has unique lyrics
    if (!rawLyrics || rawLyrics.trim().length === 0) {
      addLog('No lyrics found - auto-generating unique AI lyrics...')
      
      try {
        const lyricsResponse = await fetch(
          `${supabaseUrl}/functions/v1/generate-song-lyrics`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              title: cleanedSongTitle,
              theme: themeName ? { name: themeName, mood: themeMood, description: themeDescription } : 'universal',
              genre: primaryGenre,
              chordProgression: chordProgression ? { name: chordName, progression: chordProgression } : null,
              creativeBrief: creativeBrief
            })
          }
        )
        
        if (lyricsResponse.ok) {
          const lyricsResult = await lyricsResponse.json()
          if (lyricsResult?.lyrics) {
            rawLyrics = lyricsResult.lyrics
            addLog(`Successfully auto-generated ${rawLyrics.length} chars of unique lyrics`)
            
            // Only save generated lyrics if song didn't have original user lyrics
            // NEVER overwrite user-entered lyrics from songwriting projects
            if (!hadOriginalLyrics && !song.audio_url) {
              const { error: lyricsUpdateError } = await supabase
                .from('songs')
                .update({ lyrics: rawLyrics })
                .eq('id', songId)
              
              if (lyricsUpdateError) {
                addLog(`WARNING: Failed to save lyrics to song: ${lyricsUpdateError.message}`)
              } else {
                addLog('Saved auto-generated lyrics to song record (no original lyrics)')
              }
            } else {
              addLog('Skipping lyrics save - song had original user lyrics')
            }
            // NOTE: We NEVER overwrite songwriting_projects.lyrics - that is the user's original work
          } else {
            addLog(`WARNING: Lyrics response missing lyrics field`)
          }
        } else {
          const errorText = await lyricsResponse.text()
          addLog(`WARNING: Lyrics generation failed: ${lyricsResponse.status} - ${errorText}`)
        }
      } catch (lyricsError) {
        addLog(`WARNING: Exception during lyrics generation: ${lyricsError.message}`)
      }
    }
    
    addLog(`Final Lyrics: ${rawLyrics ? rawLyrics.length + ' chars' : 'using placeholder (fallback)'}`)

    // Build the style prompt for MiniMax Music-1.5
    let styleParts: string[] = []
    // Acoustic takes retain the stored song genre, but force an acoustic arrangement even with a custom prompt.
    if (String(song.version || "").toLowerCase() === "acoustic") {
      styleParts.push("stripped-back acoustic guitar-led arrangement")
    }

    // Use custom prompt if provided, otherwise build from metadata
    if (customPrompt) {
      addLog('Using custom prompt provided by admin')
      styleParts.push(customPrompt)
    } else {
      // Primary genre
      styleParts.push(primaryGenre)

      // Add gender-based vocal style first
      const genderVocalStyle = getGenderVocalStyle(creatorGender)
      if (genderVocalStyle) {
        styleParts.push(genderVocalStyle)
        addLog(`Gender vocal style: ${genderVocalStyle}`)
      }

      // Add chord progression context
      if (chordProgression) {
        styleParts.push(`${chordName || chordProgression}`)
      }

      // Add theme and mood
      if (themeName) {
        styleParts.push(themeName)
      }
      if (themeMood) {
        styleParts.push(`${themeMood} mood`)
      }

      // Add mood palette (limit to first 2)
      if (Array.isArray(moodPalette) && moodPalette.length > 0) {
        styleParts.push(moodPalette.slice(0, 2).join(', '))
      }

      // Add quality descriptors
      if (quality >= 80) {
        styleParts.push('polished production')
        addLog('Quality tier: Professional (80+)')
      } else if (quality >= 60) {
        styleParts.push('clean mix')
        addLog('Quality tier: Good (60-79)')
      } else if (quality >= 40) {
        styleParts.push('demo quality')
        addLog('Quality tier: Decent (40-59)')
      } else {
        styleParts.push('lo-fi')
        addLog('Quality tier: Lo-fi (<40)')
      }

      // Add energy based on genre
      const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop', 'electronic']
      const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic', 'ballad']
      
      if (highEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
        styleParts.push('high energy')
        addLog('Energy level: High')
      } else if (lowEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
        styleParts.push('mellow')
        addLog('Energy level: Low')
      }
    }

    // MiniMax uses comma-separated style description
    const validatedStyle = normalizeMiniMaxStylePrompt(styleParts.join(', '), primaryGenre)
    const stylePrompt = validatedStyle.prompt
    addLog(`MiniMax prompt: ${validatedStyle.finalLength} characters (required 10–300)`)
    if (validatedStyle.removedEmbeddedLyrics) addLog('Separated embedded Lyrics section from admin custom style prompt')
    if (validatedStyle.wasTruncated) addLog(`Trimmed custom style from ${validatedStyle.originalLength} to ${validatedStyle.finalLength} characters`)
    addLog(`Validated style: "${stylePrompt}"`)

    // Format lyrics for MiniMax Music - standard section markers
    addLog('Formatting lyrics for MiniMax Music (standard format)...')
    const formattedLyrics = formatLyricsForMiniMax(rawLyrics, cleanedSongTitle, primaryGenre, generationModel === 'music-2.6' ? 3500 : 600)
    addLog(`Formatted lyrics (${formattedLyrics.length} chars)`)

    // Combine for full prompt reference
    const fullPrompt = `Style: ${stylePrompt}\n\nLyrics:\n${formattedLyrics}`

    // Save prompt for reference
    addLog('Saving prompt to database...')
    await supabase
      .from('songs')
      .update({ audio_prompt: fullPrompt })
      .eq('id', songId)

    const { error: promptTrackingError } = await supabase.from("song_generation_attempts")
      .update({ prompt_used: `Model: ${generationModel}\n${fullPrompt}` }).eq("id", attempt.id)
    if (promptTrackingError) throw promptTrackingError
    const signature = await signReplicateAttempt(attempt.id, songId, supabaseServiceKey)
    const webhookUrl = `${supabaseUrl}/functions/v1/replicate-webhook?songId=${encodeURIComponent(songId)}&attemptId=${encodeURIComponent(attempt.id)}&signature=${signature}`
    addLog("Webhook configured; signed callback URL excluded from logs")

    // Create async prediction with webhook using MiniMax Music-1.5
    addLog('Creating async MiniMax Music prediction...')
    
    const predictionResponse = await fetch(`https://api.replicate.com/v1/models/minimax/${generationModel}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: stylePrompt,
          lyrics: formattedLyrics,
          bitrate: 128000,
          audio_format: 'mp3',
          ...(generationModel === 'music-2.6' ? {
            is_instrumental: false,
            lyrics_optimizer: false,
          } : {}),
        },
        webhook: webhookUrl,
        webhook_events_filter: ['completed', 'output'],
      })
    })

    const prediction = await predictionResponse.json()

    if (!predictionResponse.ok) {
      addLog(`ERROR: Failed to create prediction - ${prediction.detail || prediction.error || 'Unknown error'}`)
      throw new Error(`Replicate API error: ${prediction.detail || prediction.error || predictionResponse.status}`)
    }

    if (!prediction.id) throw new Error("Replicate returned no prediction ID")
    const { error: trackingError } = await supabase.from("song_generation_attempts")
      .update({ prediction_id: prediction.id, provider_prediction_id: prediction.id }).eq("id", attempt.id).eq("status", "generating")
    if (trackingError) throw trackingError
    addLog(`Prediction created: ${prediction.id}`)
    addLog(`Status: ${prediction.status}`)
    addLog(`Web URL: ${prediction.urls?.web || 'N/A'}`)
    addLog('Audio generation started! The webhook will handle completion.')
    addLog('This may take 2-5 minutes. Check song status for updates.')

    console.log(`[admin-generate-song-audio] Async prediction created: ${prediction.id} for song ${songId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        predictionId: prediction.id,
        prompt: fullPrompt,
        attemptId: attempt.id,
        songTitle: song.title,
        logs,
        message: 'Generation started asynchronously. Audio will be available in 2-5 minutes.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const invalidPrompt = /Prompt must be between 10-300 characters|E006|MiniMax style prompt length/i.test(message)
    const code = invalidPrompt ? 'MINIMAX_INVALID_STYLE_PROMPT' : 'AUDIO_GENERATION_ERROR'
    addLog(`ERROR [${code}] attempt=${activeAttemptId || 'none'}: ${message}`)
    console.error(`[admin-generate-song-audio] ${code} song=${activeSongId || 'unresolved'} attempt=${activeAttemptId || 'none'}: ${message}`)
    try {
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      if (activeSongId && activeAttemptId) {
        const { error: finishError } = await db.rpc('finish_song_generation_atomic', {
          p_song_id: activeSongId, p_attempt_id: activeAttemptId,
          p_status: 'failed', p_error_message: message,
        })
        if (finishError) console.error('[admin-generate-song-audio] Atomic failure reconciliation failed:', finishError)
      }
    } catch (trackingError) {
      console.error('[admin-generate-song-audio] Failure persistence error:',trackingError)
    }
    return new Response(JSON.stringify({error:message,code,attemptId:activeAttemptId,logs}),{
      headers:{...corsHeaders,'Content-Type':'application/json'},status:invalidPrompt?422:500
    })
  }
})

// Get vocal style based on player gender
function getGenderVocalStyle(gender: string | null): string {
  if (!gender) return 'vocal'
  
  const genderLower = gender.toLowerCase()
  
  if (genderLower === 'male') {
    return 'male vocal'
  } else if (genderLower === 'female') {
    return 'female vocal'
  } else if (genderLower === 'non-binary' || genderLower === 'other' || genderLower === 'prefer not to say') {
    return 'vocal'
  }
  
  return 'vocal'
}

// Swear words to filter out before sending to AI (will be replaced with clean alternatives)
const PROFANITY_REPLACEMENTS: Record<string, string> = {
  'fuck': 'frick',
  'fuckin': 'frickin',
  'fucking': 'frickin',
  'fucked': 'messed',
  'fucker': 'jerk',
  'shit': 'crap',
  'shitting': 'crapping',
  'shitty': 'crappy',
  'bitch': 'witch',
  'bitches': 'witches',
  'ass': 'butt',
  'asshole': 'jerk',
  'damn': 'darn',
  'damned': 'darned',
  'goddamn': 'goshdarn',
  'hell': 'heck',
  'cunt': 'jerk',
  'dick': 'jerk',
  'cock': 'rooster',
  'pussy': 'wimp',
  'whore': 'witch',
  'slut': 'witch',
  'bastard': 'jerk',
  'motherfucker': 'motherfluffer',
  'motherfucking': 'motherfluffing',
  'bullshit': 'nonsense',
  'nigga': 'homie',
  'nigger': 'homie',
  'fag': 'fool',
  'faggot': 'fool',
}

// Clean profanity from lyrics while preserving meaning
function cleanProfanity(text: string): string {
  let cleaned = text
  
  // Sort by length descending to replace longer phrases first
  const sortedWords = Object.keys(PROFANITY_REPLACEMENTS).sort((a, b) => b.length - a.length)
  
  for (const word of sortedWords) {
    const replacement = PROFANITY_REPLACEMENTS[word]
    // Case-insensitive replacement preserving original case pattern
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    cleaned = cleaned.replace(regex, (match) => {
      // Preserve capitalization
      if (match === match.toUpperCase()) return replacement.toUpperCase()
      if (match[0] === match[0].toUpperCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1)
      return replacement
    })
  }
  
  return cleaned
}

// Sanitize lyrics to remove any prompt contamination (Style: or Lyrics: prefixes)
function sanitizeLyrics(lyrics: string | null): string | null {
  if (!lyrics) return null
  
  let cleaned = lyrics.trim()
  
  // If lyrics contain "Style:" anywhere, they likely contain the full prompt - extract just lyrics
  if (cleaned.toLowerCase().includes('style:')) {
    console.log('[sanitizeLyrics] Detected Style: in lyrics, extracting actual lyrics')
    
    // Find the FIRST Lyrics: section and extract from there (flexible whitespace)
    const lyricsMatch = cleaned.match(/Lyrics:\s*([\s\S]*?)(?=\n\s*Lyrics:|\n\s*Style:|$)/i)
    if (lyricsMatch && lyricsMatch[1]) {
      cleaned = lyricsMatch[1].trim()
    } else {
      // Try to find section markers directly
      const sectionMatch = cleaned.match(/(\[(Verse|Chorus|Bridge|Intro|Hook|Pre-Chorus|Outro)[\s\S]*$)/i)
      if (sectionMatch) {
        cleaned = sectionMatch[1].trim()
      } else {
        console.warn('[sanitizeLyrics] Could not extract lyrics from corrupted prompt')
        return null
      }
    }
  }
  
  // Strip "Lyrics:" header if present (flexible whitespace)
  cleaned = cleaned.replace(/^\s*lyrics:\s*/i, '').trim()
  
  // Remove any duplicate Lyrics: sections — keep only the FIRST set of lyrics
  const lyricsSections = cleaned.split(/\n\s*Lyrics:\s*\n?/i)
  if (lyricsSections.length > 1) {
    console.log(`[sanitizeLyrics] Detected ${lyricsSections.length} Lyrics: sections, keeping first only`)
    cleaned = lyricsSections[0].trim()
  }
  
  // Detect (You) / (Me) singer markers as AI contamination signal
  if (/\((You|Me)\)/i.test(cleaned)) {
    console.log('[sanitizeLyrics] Detected (You)/(Me) singer markers - stripping them')
    cleaned = cleaned.replace(/\((You|Me)\)\s*/gi, '')
  }
  
  // Also detect duplicate song structures (two [Verse 1] or [Verse] markers = concatenated songs)
  const verseMatches = [...cleaned.matchAll(/\[(verse\s*\d*)\]/gi)]
  if (verseMatches.length > 1) {
    const verseLabels = verseMatches.map(m => m[1].toLowerCase().replace(/\s+/g, ''))
    const seen = new Set<string>()
    let duplicateIndex = -1
    for (let i = 0; i < verseLabels.length; i++) {
      if (seen.has(verseLabels[i])) {
        duplicateIndex = verseMatches[i].index!
        break
      }
      seen.add(verseLabels[i])
    }
    if (duplicateIndex > 0) {
      console.log(`[sanitizeLyrics] Detected duplicate verse marker at pos ${duplicateIndex} - truncating to first song`)
      cleaned = cleaned.substring(0, duplicateIndex).trim()
    }
  }
  
  return cleaned || null
}

// Format lyrics for MiniMax Music-1.5 - standard section markers
function formatLyricsForMiniMax(rawLyrics: string | null, songTitle: string, genre: string, maxCharacters = 600): string {
  if (!rawLyrics || rawLyrics.trim().length === 0) {
    console.log('[admin-generate-song-audio] No lyrics provided, using placeholder')
    return generatePlaceholderLyrics(songTitle, genre)
  }

  // Safety check for prompt contamination
  let processedLyrics = rawLyrics.trim()
  if (processedLyrics.toLowerCase().includes('style:') || processedLyrics.toLowerCase().startsWith('lyrics:')) {
    console.warn('[formatLyricsForMiniMax] Detected corrupted lyrics input, sanitizing...')
    const sectionMatch = processedLyrics.match(/\[(Verse|Chorus|Bridge|Intro|Hook|Pre-Chorus|Outro)[\s\S]*/i)
    if (sectionMatch) {
      processedLyrics = sectionMatch[0]
    } else {
      return generatePlaceholderLyrics(songTitle, genre)
    }
  }

  // Clean profanity
  const cleanedLyrics = cleanProfanity(processedLyrics)
  
  console.log(`[admin-generate-song-audio] Using actual lyrics: ${cleanedLyrics.length} chars`)

  // Normalize section markers for MiniMax (standard [Verse], [Chorus] format)
  let normalized = cleanedLyrics
    .replace(/\[Verse\s*(\d*)\]/gi, (_, num) => `[Verse${num ? ' ' + num : ''}]`)
    .replace(/\[Chorus\s*(\d*)\]/gi, (_, num) => `[Chorus${num ? ' ' + num : ''}]`)
    .replace(/\[Bridge\s*(\d*)\]/gi, (_, num) => `[Bridge${num ? ' ' + num : ''}]`)
    .replace(/\[Pre-?Chorus\s*(\d*)\]/gi, (_, num) => `[Pre-Chorus${num ? ' ' + num : ''}]`)
    .replace(/\[Outro\s*\d*\]/gi, '[Outro]')
    .replace(/\[Intro\s*\d*\]/gi, '[Intro]')
    .replace(/\[Hook\s*\d*\]/gi, '[Hook]')
    .replace(/\[Post-?Chorus\s*\d*\]/gi, '[Post-Chorus]')
    .replace(/\([A-Gm#b\-\/\s]+\)/g, '')
    .replace(/\((She|He|Both|You|Me)\)\s*/gi, '')

  const hasMarkers = /\[(Verse|Chorus|Bridge|Outro|Intro|Hook|Pre-Chorus|Post-Chorus)\]/i.test(normalized)

  if (!hasMarkers) {
    const lines = normalized.split('\n').filter(l => l.trim())
    if (lines.length === 0) return generatePlaceholderLyrics(songTitle, genre)
    
    const midpoint = Math.ceil(lines.length / 2)
    const verse = lines.slice(0, midpoint).join('\n')
    const chorus = lines.slice(midpoint).join('\n') || lines.slice(0, Math.min(4, lines.length)).join('\n')
    normalized = `[Verse]\n${verse}\n\n[Chorus]\n${chorus}`
  }

  // Clean up extra whitespace
  normalized = normalized.replace(/\n{3,}/g, '\n\n').trim()
  normalized = normalized.replace(/^\n+/, '')

  // MiniMax Music requires lyrics within the selected model's character limit — truncate smartly if needed
  if (normalized.length > maxCharacters) {
    console.log(`[admin-generate-song-audio] Lyrics too long (${normalized.length} chars), truncating to ${maxCharacters} char limit`)
    // Try to truncate at a section boundary
    const sections = normalized.split(/(?=\[(?:Verse|Chorus|Bridge|Pre-Chorus|Outro|Intro|Hook|Post-Chorus))/i)
    let truncated = ''
    for (const section of sections) {
      if ((truncated + section).length <= maxCharacters) {
        truncated += section
      } else {
        break
      }
    }
    // If we got at least one section, use it; otherwise hard truncate at last newline before limit
    if (truncated.trim().length >= 10) {
      normalized = truncated.trim()
    } else {
      normalized = normalized.substring(0, maxCharacters)
      const lastNewline = normalized.lastIndexOf('\n')
      if (lastNewline > 100) normalized = normalized.substring(0, lastNewline).trim()
    }
    console.log(`[admin-generate-song-audio] Truncated lyrics to ${normalized.length} chars`)
  }

  console.log(`[admin-generate-song-audio] Formatted lyrics for MiniMax: ${normalized.length} chars`)
  return normalized
}

// Generate placeholder lyrics when none exist
function generatePlaceholderLyrics(songTitle: string, genre: string): string {
  const title = songTitle || 'This song'
  
  return `[Verse]
${title}
Feel the rhythm tonight
${title}
Everything feels right

[Chorus]
${title}
${title}`
}
