import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Replicate from "https://esm.sh/replicate@0.25.2"

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

    // Get comprehensive song details with all metadata (matching player function)
    addLog('Fetching comprehensive song details from database...')
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select(`
        *,
        songwriting_projects!songs_id_fkey (
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
        )
      `)
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

    addLog(`Found song: "${song.title}" (Genre: ${song.genre || 'not set'}, Quality: ${song.quality_score || 'not set'})`)

    // Update status to generating
    addLog('Setting status to "generating"...')
    await supabase
      .from('songs')
      .update({ 
        audio_generation_status: 'generating',
        audio_generation_started_at: new Date().toISOString()
      })
      .eq('id', songId)

    // Extract metadata from songwriting project (matching player function logic)
    const project = song.songwriting_projects?.[0] || song.songwriting_projects
    const creativeBrief = project?.creative_brief as Record<string, any> || {}
    
    // Build comprehensive prompt for MiniMax Music-1.5
    const songTitle = project?.title || song.title || 'Untitled'
    const primaryGenre = song.genre || project?.genres?.[0] || 'pop'
    const chordProgression = project?.chord_progressions?.progression || null
    const chordName = project?.chord_progressions?.name || null
    const themeName = project?.song_themes?.name || null
    const themeMood = project?.song_themes?.mood || null
    const themeDescription = project?.song_themes?.description || null
    const rawLyrics = project?.lyrics || null
    const quality = song.quality_score || project?.quality_score || 50
    const durationSeconds = song.duration_seconds || 180

    // Extract from creative_brief if available
    const inspirationAnchor = creativeBrief?.inspirationAnchor || creativeBrief?.inspiration_anchor || null
    const moodPalette = creativeBrief?.moodPalette || creativeBrief?.mood_palette || []
    const targetAudience = creativeBrief?.targetAudience || creativeBrief?.target_audience || null

    addLog(`Song metadata extracted:`)
    addLog(`  - Title: ${songTitle}`)
    addLog(`  - Genre: ${primaryGenre}`)
    addLog(`  - Chord Progression: ${chordProgression || 'None'}`)
    addLog(`  - Theme: ${themeName || 'None'} (${themeMood || 'N/A'})`)
    addLog(`  - Inspiration: ${inspirationAnchor || 'None'}`)
    addLog(`  - Mood Palette: ${Array.isArray(moodPalette) && moodPalette.length > 0 ? moodPalette.join(', ') : 'None'}`)
    addLog(`  - Has Lyrics: ${!!rawLyrics}`)
    addLog(`  - Quality Score: ${quality}`)
    addLog(`  - Duration: ${durationSeconds}s`)

    // Build the style prompt for MiniMax (matching player function)
    let styleParts: string[] = []

    // Use custom prompt if provided, otherwise build from metadata
    if (customPrompt) {
      addLog('Using custom prompt provided by admin')
      styleParts.push(customPrompt)
    } else {
      // Primary genre and style
      styleParts.push(`${primaryGenre}`)

      // Add chord progression context
      if (chordProgression) {
        styleParts.push(`${chordName || chordProgression} progression`)
      }

      // Add theme and mood
      if (themeName) {
        styleParts.push(`${themeName}`)
      }
      if (themeMood) {
        styleParts.push(`${themeMood} mood`)
      }
      if (themeDescription) {
        styleParts.push(themeDescription)
      }

      // Add mood palette
      if (Array.isArray(moodPalette) && moodPalette.length > 0) {
        styleParts.push(moodPalette.join(', '))
      }

      // Add inspiration anchor
      if (inspirationAnchor) {
        styleParts.push(`inspired by ${inspirationAnchor}`)
      }

      // Add quality descriptors
      if (quality >= 80) {
        styleParts.push('professional studio quality, polished production')
        addLog('Quality tier: Professional (80+)')
      } else if (quality >= 60) {
        styleParts.push('good quality, clean mix')
        addLog('Quality tier: Good (60-79)')
      } else if (quality >= 40) {
        styleParts.push('demo quality')
        addLog('Quality tier: Decent (40-59)')
      } else {
        styleParts.push('lo-fi, raw')
        addLog('Quality tier: Lo-fi (<40)')
      }

      // Add energy based on genre
      const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop', 'electronic']
      const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic', 'ballad']
      
      if (highEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
        styleParts.push('high energy, driving beat')
        addLog('Energy level: High')
      } else if (lowEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
        styleParts.push('mellow, relaxed tempo')
        addLog('Energy level: Low')
      } else {
        addLog('Energy level: Medium')
      }

      // Add vocal style based on genre
      const vocalStyle = getVocalStyleForGenre(primaryGenre)
      if (vocalStyle) {
        styleParts.push(vocalStyle)
        addLog(`Vocal style: ${vocalStyle}`)
      }
    }

    const stylePrompt = styleParts.join(', ')
    addLog(`Style prompt: "${stylePrompt}"`)

    // Format lyrics with section markers for MiniMax
    addLog('Formatting lyrics for MiniMax Music-1.5...')
    const formattedLyrics = formatLyricsForMiniMax(rawLyrics, songTitle, primaryGenre)
    addLog(`Formatted lyrics preview: "${formattedLyrics.substring(0, 150)}..."`)

    // Combine for full prompt reference
    const fullPrompt = `Style: ${stylePrompt}\n\nLyrics:\n${formattedLyrics}`

    // Save prompt for reference
    addLog('Saving prompt to database...')
    await supabase
      .from('songs')
      .update({ audio_prompt: fullPrompt })
      .eq('id', songId)

    // Initialize Replicate
    addLog('Initializing Replicate API client...')
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    // Calculate song duration (1-4 minutes for MiniMax)
    const songDuration = Math.min(240, Math.max(60, durationSeconds))
    addLog(`Song duration: ${durationSeconds}s, using ${songDuration}s for MiniMax`)

    // Generate audio using MiniMax Music-1.5 with vocals
    addLog('Calling Replicate MiniMax Music-1.5 API (this may take 60-180 seconds)...')
    const startTime = Date.now()
    
    const output = await replicate.run(
      "minimax/music-1.5",
      {
        input: {
          lyrics: formattedLyrics,
          prompt: stylePrompt,
          song_duration: songDuration,
          bitrate: 192,
          sample_rate: 44100
        }
      }
    )

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
    addLog(`Replicate API completed in ${elapsedTime}s`)

    console.log(`[admin-generate-song-audio] Replicate output:`, output)

    if (!output) {
      addLog('ERROR: No audio generated - empty response from Replicate')
      throw new Error('No audio generated')
    }

    const audioUrl = typeof output === 'string' ? output : (output as any)?.audio || (output as any)?.[0]

    if (!audioUrl) {
      addLog('ERROR: No audio URL found in Replicate response')
      console.error('[admin-generate-song-audio] Unexpected output format:', JSON.stringify(output))
      throw new Error('No audio URL in response')
    }

    addLog(`Audio URL received: ${audioUrl.substring(0, 50)}...`)

    // Update song with audio URL
    addLog('Saving audio URL to database...')
    const { error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: audioUrl,
        audio_generation_status: 'completed',
        audio_generated_at: new Date().toISOString()
      })
      .eq('id', songId)

    if (updateError) {
      addLog(`ERROR: Failed to save audio URL - ${updateError.message}`)
      console.error('[admin-generate-song-audio] Update error:', updateError)
      throw new Error('Failed to save audio URL')
    }

    addLog('SUCCESS: Audio generation with vocals complete!')
    console.log(`[admin-generate-song-audio] Successfully generated audio for song ${songId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl,
        prompt: fullPrompt,
        songTitle: song.title,
        logs,
        generationTimeSeconds: elapsedTime
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

// Get vocal style based on genre
function getVocalStyleForGenre(genre: string): string {
  const genreLower = genre.toLowerCase()
  
  if (genreLower.includes('rock') || genreLower.includes('metal')) {
    return 'powerful vocals, raw energy'
  } else if (genreLower.includes('pop')) {
    return 'catchy vocals, clear and bright'
  } else if (genreLower.includes('hip-hop') || genreLower.includes('rap')) {
    return 'rhythmic vocals, flow and delivery'
  } else if (genreLower.includes('r&b') || genreLower.includes('soul')) {
    return 'soulful vocals, smooth and emotive'
  } else if (genreLower.includes('country')) {
    return 'country vocals, storytelling tone'
  } else if (genreLower.includes('jazz')) {
    return 'jazz vocals, smooth and improvisational'
  } else if (genreLower.includes('folk') || genreLower.includes('acoustic')) {
    return 'folk vocals, warm and intimate'
  } else if (genreLower.includes('electronic') || genreLower.includes('edm')) {
    return 'processed vocals, synth-enhanced'
  } else if (genreLower.includes('punk')) {
    return 'punk vocals, raw and energetic'
  } else if (genreLower.includes('indie')) {
    return 'indie vocals, unique and expressive'
  } else if (genreLower.includes('blues')) {
    return 'blues vocals, soulful and gritty'
  } else if (genreLower.includes('reggae')) {
    return 'reggae vocals, laid-back and rhythmic'
  }
  
  return 'clear vocals'
}

// Format lyrics with section markers for MiniMax Music-1.5
function formatLyricsForMiniMax(rawLyrics: string | null, songTitle: string, genre: string): string {
  // If no lyrics, generate placeholder structure
  if (!rawLyrics || rawLyrics.trim().length === 0) {
    return generatePlaceholderLyrics(songTitle, genre)
  }

  // Check if lyrics already have section markers
  if (rawLyrics.includes('[Verse]') || rawLyrics.includes('[Chorus]') || 
      rawLyrics.includes('[verse]') || rawLyrics.includes('[chorus]')) {
    // Normalize markers to proper format
    return normalizeLyricMarkers(rawLyrics)
  }

  // Parse and add section markers to unmarked lyrics
  return addSectionMarkers(rawLyrics, genre)
}

// Normalize existing markers to MiniMax format
function normalizeLyricMarkers(lyrics: string): string {
  return lyrics
    .replace(/\[verse\s*\d*\]/gi, '[Verse]')
    .replace(/\[chorus\]/gi, '[Chorus]')
    .replace(/\[bridge\]/gi, '[Bridge]')
    .replace(/\[pre-?chorus\]/gi, '[Pre-Chorus]')
    .replace(/\[outro\]/gi, '[Outro]')
    .replace(/\[intro\]/gi, '[Intro]')
    .replace(/\[hook\]/gi, '[Hook]')
}

// Add section markers to lyrics that don't have them
function addSectionMarkers(lyrics: string, genre: string): string {
  const lines = lyrics.split('\n').filter(line => line.trim().length > 0)
  
  if (lines.length === 0) return '[Verse]\nLa la la'
  
  const result: string[] = []
  let currentSection = 'verse'
  let lineCount = 0
  let verseCount = 1
  let hasChorus = false
  
  // Try to identify chorus by repeated lines
  const lineCounts: Record<string, number> = {}
  lines.forEach(line => {
    const normalized = line.toLowerCase().trim()
    lineCounts[normalized] = (lineCounts[normalized] || 0) + 1
  })
  const repeatedLines = new Set(
    Object.entries(lineCounts)
      .filter(([_, count]) => count >= 2)
      .map(([line, _]) => line)
  )

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const normalizedLine = line.toLowerCase().trim()
    
    // Start with verse
    if (i === 0) {
      result.push('[Verse]')
    }
    
    // Check if this looks like a chorus (repeated line or starts with typical chorus words)
    const isRepeated = repeatedLines.has(normalizedLine)
    const chorusIndicators = ['oh', 'yeah', 'hey', 'come on', 'let\'s go', 'whoa']
    const looksLikeChorus = isRepeated || chorusIndicators.some(ind => normalizedLine.startsWith(ind))
    
    // Switch sections based on line count and content
    if (lineCount >= 4 && currentSection === 'verse') {
      if (looksLikeChorus && !hasChorus) {
        result.push('\n[Chorus]')
        currentSection = 'chorus'
        hasChorus = true
        lineCount = 0
      } else if (lineCount >= 8) {
        verseCount++
        result.push(`\n[Verse]`)
        currentSection = 'verse'
        lineCount = 0
      }
    } else if (lineCount >= 4 && currentSection === 'chorus') {
      verseCount++
      result.push(`\n[Verse]`)
      currentSection = 'verse'
      lineCount = 0
    }
    
    result.push(line)
    lineCount++
  }
  
  // Add outro if we have enough content
  if (lines.length > 12) {
    result.push('\n[Outro]')
  }
  
  return result.join('\n')
}

// Generate placeholder lyrics when none exist
function generatePlaceholderLyrics(songTitle: string, genre: string): string {
  const titleWords = songTitle.split(' ').slice(0, 3).join(' ')
  
  return `[Verse]
${titleWords}, yeah
Feel the rhythm in my soul
${titleWords}, oh
Let the music take control

[Chorus]
${titleWords}
${titleWords}
Feel it in your heart tonight
${titleWords}

[Verse]
Moving through the night
Everything feels so right
${titleWords}, yeah
Dancing in the light

[Chorus]
${titleWords}
${titleWords}
Feel it in your heart tonight
${titleWords}

[Outro]
${titleWords}...`
}
