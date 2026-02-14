import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    if (!REPLICATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'REPLICATE_API_KEY is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const { songId, customPrompt } = await req.json()

    if (!songId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: songId" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const logs: string[] = []
    const addLog = (message: string) => {
      const timestamp = new Date().toISOString()
      const logEntry = `[${timestamp}] ${message}`
      logs.push(logEntry)
      console.log(`[admin-generate-song-audio] ${message}`)
    }

    addLog(`Starting MiniMax Music-1.5 generation for song ${songId} by admin ${user.id}`)

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
      addLog(`Previous generation appears stuck (${Math.round(elapsed / 60000)} mins), allowing restart`)
    }
    
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

    // Update status to generating
    addLog('Setting status to "generating"...')
    await supabase
      .from('songs')
      .update({ 
        audio_generation_status: 'generating',
        audio_generation_started_at: new Date().toISOString()
      })
      .eq('id', songId)

    // Extract creative brief from project
    const creativeBrief = project?.creative_brief as Record<string, any> || {}
    
    // Build comprehensive prompt for YuE
    const rawSongTitle = project?.title || song.title || 'Untitled'
    const cleanedSongTitle = cleanProfanity(rawSongTitle)
    const primaryGenre = song.genre || project?.genres?.[0] || 'pop'
    const chordProgression = project?.chord_progressions?.progression || null
    const chordName = project?.chord_progressions?.name || null
    const themeName = project?.song_themes?.name || null
    const themeMood = project?.song_themes?.mood || null
    const themeDescription = project?.song_themes?.description || null
    // Prefer song lyrics, fallback to project lyrics - sanitize to remove any prompt contamination
    // Track originals to avoid overwriting user-written lyrics
    const originalSongLyrics = song.lyrics
    const originalProjectLyrics = project?.lyrics
    let rawLyrics = sanitizeLyrics(song.lyrics) || sanitizeLyrics(project?.lyrics) || null
    const hadOriginalLyrics = !!(originalSongLyrics?.trim() || originalProjectLyrics?.trim())
    const quality = song.quality_score || project?.quality_score || 50
    const durationSeconds = song.duration_seconds || 180

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
            if (!hadOriginalLyrics) {
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

    // Build the genre description for YuE (space-separated tags)
    let styleParts: string[] = []

    // Use custom prompt if provided, otherwise build from metadata
    if (customPrompt) {
      addLog('Using custom prompt provided by admin')
      styleParts.push(customPrompt)
    } else {
      // Primary genre and style
      styleParts.push(`${primaryGenre}`)

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
        styleParts.push(`${themeName}`)
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

    // YuE uses space-separated genre tags
    let stylePrompt = styleParts.join(' ')
    if (stylePrompt.length < 10) {
      stylePrompt = `${primaryGenre} vocal song`
    }
    addLog(`Genre description (${stylePrompt.length} chars): "${stylePrompt}"`)

    // Format lyrics for YuE - uses lowercase [verse], [chorus] tags, no character limit
    addLog('Formatting lyrics for YuE (full lyrics, faithful reproduction)...')
    const formattedLyrics = formatLyricsForYuE(rawLyrics, cleanedSongTitle, primaryGenre)
    addLog(`Formatted lyrics (${formattedLyrics.length} chars)`)

    // Combine for full prompt reference
    const fullPrompt = `Style: ${stylePrompt}\n\nLyrics:\n${formattedLyrics}`

    // Save prompt for reference
    addLog('Saving prompt to database...')
    await supabase
      .from('songs')
      .update({ audio_prompt: fullPrompt })
      .eq('id', songId)

    // Calculate number of segments (~30s each) based on desired duration
    const numSegments = Math.min(10, Math.max(2, Math.round(durationSeconds / 30)))
    addLog(`Song duration: ${durationSeconds}s, using ${numSegments} segments for YuE`)

    // Build webhook URL with songId
    const webhookUrl = `${supabaseUrl}/functions/v1/replicate-webhook?songId=${songId}`
    addLog(`Webhook URL: ${webhookUrl}`)

    // Create async prediction with webhook (returns immediately)
    addLog(`Creating async Replicate prediction (${numSegments} segments)...`)
    
    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'f45da0cfbe372eb9116e87a1e3519aceb008fd03b0d771d21fb8627bee2b4117',
        input: {
          lyrics: formattedLyrics,
          genre_description: stylePrompt,
          num_segments: numSegments,
          max_new_tokens: 3000,
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
        songTitle: song.title,
        logs,
        message: 'Generation started asynchronously. Audio will be available in 2-5 minutes.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-generate-song-audio] Error:', error)
    
    // Try to update song status to failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const { songId } = await req.clone().json().catch(() => ({}))
      if (songId) {
        await supabase
          .from('songs')
          .update({ audio_generation_status: 'failed' })
          .eq('id', songId)
      }
    } catch (e) {
      console.error('[admin-generate-song-audio] Failed to update status to failed:', e)
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Get vocal style based on player gender (space-separated tags for YuE)
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
  
  // If lyrics start with "Style:" they contain the full prompt - extract just the lyrics part
  if (cleaned.toLowerCase().startsWith('style:')) {
    console.log('[sanitizeLyrics] Detected Style: prefix in lyrics, extracting actual lyrics')
    
    // Find the Lyrics: section and extract from there
    const lyricsMatch = cleaned.match(/Lyrics:\s*([\s\S]*?)(?=\n\nLyrics:|$)/i)
    if (lyricsMatch && lyricsMatch[1]) {
      cleaned = lyricsMatch[1].trim()
    } else {
      // Try to find section markers directly
      const sectionMatch = cleaned.match(/(\[(Verse|Chorus|Bridge|Intro|Hook|Pre-Chorus|Outro)[\s\S]*$)/i)
      if (sectionMatch) {
        cleaned = sectionMatch[1].trim()
      } else {
        // Can't extract, return null to trigger regeneration
        console.warn('[sanitizeLyrics] Could not extract lyrics from corrupted prompt')
        return null
      }
    }
  }
  
  // Also check if lyrics start with "Lyrics:" header
  if (cleaned.toLowerCase().startsWith('lyrics:')) {
    cleaned = cleaned.replace(/^lyrics:\s*/i, '').trim()
  }
  
  // Remove any duplicate Lyrics: sections (take first one only)
  if (cleaned.split(/\n\nLyrics:/i).length > 1) {
    console.log('[sanitizeLyrics] Detected duplicate Lyrics: sections, keeping first')
    cleaned = cleaned.split(/\n\nLyrics:/i)[0].trim()
  }
  
  return cleaned || null
}

// Format lyrics for YuE model - uses lowercase [verse], [chorus] tags
// YuE has NO character limit and faithfully sings provided lyrics
function formatLyricsForYuE(rawLyrics: string | null, songTitle: string, genre: string): string {
  if (!rawLyrics || rawLyrics.trim().length === 0) {
    console.log('[admin-generate-song-audio] No lyrics provided, using placeholder')
    return generatePlaceholderLyrics(songTitle, genre)
  }

  // Safety check for prompt contamination
  let processedLyrics = rawLyrics.trim()
  if (processedLyrics.toLowerCase().includes('style:') || processedLyrics.toLowerCase().startsWith('lyrics:')) {
    console.warn('[formatLyricsForYuE] Detected corrupted lyrics input, sanitizing...')
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

  // Normalize section markers to lowercase for YuE
  let normalized = cleanedLyrics
    .replace(/\[Verse\s*(\d*)\]/gi, (_, num) => `[verse]`)
    .replace(/\[Chorus\s*(\d*)\]/gi, (_, num) => `[chorus]`)
    .replace(/\[Bridge\s*(\d*)\]/gi, (_, num) => `[bridge]`)
    .replace(/\[Pre-?Chorus\s*(\d*)\]/gi, (_, num) => `[verse]`)
    .replace(/\[Outro\s*\d*\]/gi, '[outro]')
    .replace(/\[Intro\s*\d*\]/gi, '[verse]')
    .replace(/\[Hook\s*\d*\]/gi, '[chorus]')
    .replace(/\[Post-?Chorus\s*\d*\]/gi, '[chorus]')
    .replace(/\([A-Gm#b\-\/\s]+\)/g, '')
    .replace(/\((She|He|Both|You|Me)\)\s*/gi, '')

  const hasMarkers = /\[(verse|chorus|bridge|outro)\]/i.test(normalized)

  if (!hasMarkers) {
    const lines = normalized.split('\n').filter(l => l.trim())
    if (lines.length === 0) return generatePlaceholderLyrics(songTitle, genre)
    
    const midpoint = Math.ceil(lines.length / 2)
    const verse = lines.slice(0, midpoint).join('\n')
    const chorus = lines.slice(midpoint).join('\n') || lines.slice(0, Math.min(4, lines.length)).join('\n')
    return `[verse]\n${verse}\n\n[chorus]\n${chorus}`
  }

  // Ensure sections are separated by double newlines (YuE requirement)
  normalized = normalized.replace(/\n?\[(verse|chorus|bridge|outro)\]/gi, (match) => `\n\n${match.trim()}`)
  normalized = normalized.replace(/\n{3,}/g, '\n\n').trim()
  normalized = normalized.replace(/^\n+/, '')

  console.log(`[admin-generate-song-audio] Formatted lyrics for YuE: ${normalized.length} chars`)
  return normalized
}

// Generate placeholder lyrics when none exist
function generatePlaceholderLyrics(songTitle: string, genre: string): string {
  const title = songTitle || 'This song'
  
  return `[verse]
${title}
Feel the rhythm tonight
${title}
Everything feels right

[chorus]
${title}
${title}`
}
