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
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY is not set')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { songId, userId } = await req.json()

    if (!songId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: songId and userId" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log(`[generate-song-audio] Starting generation for song ${songId}, user ${userId}`)

    // Check if song already has completed audio (block regeneration)
    const { data: existingSong, error: existingSongError } = await supabase
      .from('songs')
      .select('audio_url, audio_generation_status')
      .eq('id', songId)
      .single()

    if (existingSongError) {
      console.error('[generate-song-audio] Error checking existing song:', existingSongError)
      throw new Error('Failed to check song status')
    }

    if (existingSong?.audio_url && existingSong?.audio_generation_status === 'completed') {
      return new Response(
        JSON.stringify({ error: "Song already has generated audio. Regeneration is not allowed." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Check weekly generation limit
    const { data: limitData, error: limitError } = await supabase
      .rpc('check_song_generation_limit', { p_user_id: userId })

    if (limitError) {
      console.error('[generate-song-audio] Limit check error:', limitError)
      throw new Error('Failed to check generation limits')
    }

    console.log(`[generate-song-audio] Limit check: ${JSON.stringify(limitData)}`)

    if (!limitData?.can_generate) {
      return new Response(
        JSON.stringify({ 
          error: "Weekly generation limit reached",
          details: `You have used ${limitData.used}/${limitData.limit} generations this week. Resets in 7 days.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    // Check VIP status (skip for admins)
    if (!limitData?.is_admin) {
      const { data: vipData, error: vipError } = await supabase
        .from('vip_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle()

      if (vipError) {
        console.error('[generate-song-audio] VIP check error:', vipError)
        throw new Error('Failed to verify VIP status')
      }

      if (!vipData) {
        return new Response(
          JSON.stringify({ error: "VIP subscription required for AI music generation" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
    }

    // Get comprehensive song details with all metadata
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
      console.error('[generate-song-audio] Song fetch error:', songError)
      throw new Error('Song not found')
    }

    console.log(`[generate-song-audio] Song data retrieved: ${song.title}`)

    // Create generation attempt record
    const { data: attempt, error: attemptError } = await supabase
      .from('song_generation_attempts')
      .insert({
        user_id: userId,
        song_id: songId,
        status: 'generating'
      })
      .select()
      .single()

    if (attemptError) {
      console.error('[generate-song-audio] Failed to create attempt record:', attemptError)
    }

    // Update song status to generating
    await supabase
      .from('songs')
      .update({ 
        audio_generation_status: 'generating',
        audio_generation_started_at: new Date().toISOString()
      })
      .eq('id', songId)

    // Extract metadata from songwriting project
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

    console.log(`[generate-song-audio] Building MiniMax prompt for "${songTitle}"`)
    console.log(`[generate-song-audio] Genre: ${primaryGenre}`)
    console.log(`[generate-song-audio] Chord Progression: ${chordProgression}`)
    console.log(`[generate-song-audio] Theme: ${themeName} (${themeMood})`)
    console.log(`[generate-song-audio] Inspiration: ${inspirationAnchor}`)
    console.log(`[generate-song-audio] Mood Palette: ${JSON.stringify(moodPalette)}`)
    console.log(`[generate-song-audio] Has Lyrics: ${!!rawLyrics}`)

    // Build the style prompt for MiniMax
    let styleParts: string[] = []

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
    } else if (quality >= 60) {
      styleParts.push('good quality, clean mix')
    } else if (quality >= 40) {
      styleParts.push('demo quality')
    } else {
      styleParts.push('lo-fi, raw')
    }

    // Add energy based on genre
    const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop', 'electronic']
    const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic', 'ballad']
    
    if (highEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
      styleParts.push('high energy, driving beat')
    } else if (lowEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
      styleParts.push('mellow, relaxed tempo')
    }

    // Add vocal style based on genre
    const vocalStyle = getVocalStyleForGenre(primaryGenre)
    if (vocalStyle) {
      styleParts.push(vocalStyle)
    }

    const stylePrompt = styleParts.join(', ')
    console.log(`[generate-song-audio] Style prompt: "${stylePrompt}"`)

    // Format lyrics with section markers for MiniMax
    const formattedLyrics = formatLyricsForMiniMax(rawLyrics, songTitle, primaryGenre)
    console.log(`[generate-song-audio] Formatted lyrics preview: ${formattedLyrics.substring(0, 200)}...`)

    // Combine for full prompt reference
    const fullPrompt = `Style: ${stylePrompt}\n\nLyrics:\n${formattedLyrics}`

    // Save prompt for reference
    await supabase
      .from('songs')
      .update({ audio_prompt: fullPrompt })
      .eq('id', songId)

    // Update attempt with prompt
    if (attempt?.id) {
      await supabase
        .from('song_generation_attempts')
        .update({ prompt_used: fullPrompt })
        .eq('id', attempt.id)
    }

    // Initialize Replicate
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    console.log(`[generate-song-audio] Calling Replicate MiniMax Music-1.5 API...`)

    // Generate audio using MiniMax Music-1.5 with vocals
    const output = await replicate.run(
      "minimax/music-1.5",
      {
        input: {
          lyrics: formattedLyrics,
          prompt: stylePrompt,
          song_duration: Math.min(240, Math.max(60, durationSeconds)), // 1-4 minutes
          bitrate: 192,
          sample_rate: 44100
        }
      }
    )

    console.log(`[generate-song-audio] Replicate output received`)

    if (!output) {
      throw new Error('No audio generated')
    }

    // The output is typically a URL to the generated audio
    const audioUrl = typeof output === 'string' ? output : (output as any)?.audio || (output as any)?.[0]

    if (!audioUrl) {
      console.error('[generate-song-audio] Unexpected output format:', JSON.stringify(output))
      throw new Error('No audio URL in response')
    }

    console.log(`[generate-song-audio] Audio URL: ${audioUrl}`)

    // Update song with audio URL
    const { error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: audioUrl,
        audio_generation_status: 'completed',
        audio_generated_at: new Date().toISOString()
      })
      .eq('id', songId)

    if (updateError) {
      console.error('[generate-song-audio] Update error:', updateError)
      throw new Error('Failed to save audio URL')
    }

    // Update attempt record
    if (attempt?.id) {
      await supabase
        .from('song_generation_attempts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', attempt.id)
    }

    console.log(`[generate-song-audio] Successfully generated audio with vocals for song ${songId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl,
        message: `Audio with vocals generated for "${songTitle}"`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[generate-song-audio] Error:', error)
    
    // Try to update status to failed
    try {
      const body = await req.clone().json().catch(() => ({}))
      const { songId, userId } = body
      
      if (songId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        
        await supabase
          .from('songs')
          .update({ audio_generation_status: 'failed' })
          .eq('id', songId)

        // Update any generating attempts to failed
        await supabase
          .from('song_generation_attempts')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('song_id', songId)
          .eq('status', 'generating')
      }
    } catch (e) {
      console.error('[generate-song-audio] Failed to update failure status:', e)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

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
Shining like a light

[Chorus]
${titleWords}
${titleWords}
Feel it in your heart tonight
${titleWords}

[Outro]
${titleWords}
Yeah...`
}

// Get vocal style based on genre
function getVocalStyleForGenre(genre: string): string {
  const genreLower = genre.toLowerCase()
  
  if (genreLower.includes('rock') || genreLower.includes('metal')) {
    return 'powerful vocals, gritty voice'
  } else if (genreLower.includes('pop')) {
    return 'catchy vocals, clear voice'
  } else if (genreLower.includes('hip-hop') || genreLower.includes('rap')) {
    return 'rhythmic flow, rap vocals'
  } else if (genreLower.includes('r&b') || genreLower.includes('soul')) {
    return 'soulful vocals, smooth voice'
  } else if (genreLower.includes('country')) {
    return 'country vocals, twang'
  } else if (genreLower.includes('jazz')) {
    return 'jazz vocals, smooth crooning'
  } else if (genreLower.includes('electronic') || genreLower.includes('edm')) {
    return 'processed vocals, euphoric'
  } else if (genreLower.includes('folk') || genreLower.includes('acoustic')) {
    return 'warm vocals, intimate'
  } else if (genreLower.includes('punk')) {
    return 'raw vocals, aggressive'
  } else if (genreLower.includes('indie')) {
    return 'indie vocals, unique timbre'
  }
  
  return 'clear vocals'
}
