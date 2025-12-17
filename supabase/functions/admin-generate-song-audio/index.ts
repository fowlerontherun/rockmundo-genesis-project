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

    // Build the style prompt for MiniMax
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
        styleParts.push(`${chordName || chordProgression} progression`)
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

    // MiniMax requires prompt between 10-300 characters
    let stylePrompt = styleParts.join(', ')
    if (stylePrompt.length > 300) {
      stylePrompt = stylePrompt.substring(0, 297) + '...'
      addLog(`Style prompt truncated to 300 chars (was ${styleParts.join(', ').length})`)
    } else if (stylePrompt.length < 10) {
      stylePrompt = `${primaryGenre} song with vocals`
      addLog(`Style prompt expanded to minimum 10 chars`)
    }
    addLog(`Style prompt (${stylePrompt.length} chars): "${stylePrompt}"`)

    // Format lyrics with section markers for MiniMax - ONLY essential sections
    addLog('Formatting lyrics for MiniMax Music-1.5 (essential sections only)...')
    const formattedLyrics = formatLyricsForMiniMax(rawLyrics, songTitle, primaryGenre)
    addLog(`Formatted lyrics (${formattedLyrics.length} chars): "${formattedLyrics.substring(0, 100)}..."`)

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
          bitrate: 128000,
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

    const replicateAudioUrl = typeof output === 'string' ? output : (output as any)?.audio || (output as any)?.[0]

    if (!replicateAudioUrl) {
      addLog('ERROR: No audio URL found in Replicate response')
      console.error('[admin-generate-song-audio] Unexpected output format:', JSON.stringify(output))
      throw new Error('No audio URL in response')
    }

    addLog(`Replicate URL received: ${replicateAudioUrl.substring(0, 50)}...`)

    // Download audio from Replicate and upload to Supabase Storage
    addLog('Downloading audio from Replicate...')
    const audioResponse = await fetch(replicateAudioUrl)
    
    if (!audioResponse.ok) {
      addLog(`ERROR: Failed to download audio - HTTP ${audioResponse.status}`)
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }
    
    const audioBlob = await audioResponse.blob()
    const audioBuffer = await audioBlob.arrayBuffer()
    const audioBytes = new Uint8Array(audioBuffer)
    
    addLog(`Audio downloaded: ${(audioBytes.length / 1024 / 1024).toFixed(2)} MB`)
    
    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    const filename = `${songId}/${sanitizedTitle}_${timestamp}.mp3`
    
    addLog(`Uploading to Supabase Storage: music/${filename}`)
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('music')
      .upload(filename, audioBytes, {
        contentType: 'audio/mpeg',
        upsert: true
      })
    
    if (uploadError) {
      addLog(`ERROR: Storage upload failed - ${uploadError.message}`)
      console.error('[admin-generate-song-audio] Storage upload error:', uploadError)
      throw new Error(`Failed to upload to storage: ${uploadError.message}`)
    }
    
    addLog(`Upload successful: ${JSON.stringify(uploadData)}`)
    
    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('music')
      .getPublicUrl(filename)
    
    const audioUrl = publicUrlData.publicUrl
    addLog(`Supabase Storage URL: ${audioUrl}`)

    // Update song with Supabase storage URL
    addLog('Saving Supabase storage URL to database...')
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

// Get vocal style based on player gender
function getGenderVocalStyle(gender: string | null): string {
  if (!gender) return 'clear vocals'
  
  const genderLower = gender.toLowerCase()
  
  if (genderLower === 'male') {
    return 'male vocals, male singer'
  } else if (genderLower === 'female') {
    return 'female vocals, female singer'
  } else if (genderLower === 'non-binary' || genderLower === 'other' || genderLower === 'prefer not to say') {
    return 'gender-neutral vocals'
  }
  
  return 'clear vocals'
}

// Format lyrics with section markers for MiniMax Music-1.5
// ONLY includes essential sections: Intro (if exists), first Verse, Chorus, Bridge
function formatLyricsForMiniMax(rawLyrics: string | null, songTitle: string, genre: string): string {
  // If no lyrics, generate placeholder structure
  if (!rawLyrics || rawLyrics.trim().length === 0) {
    return generatePlaceholderLyrics(songTitle, genre)
  }

  // Extract only essential sections to stay under character limit
  return extractEssentialSections(rawLyrics, songTitle, genre)
}

// Extract only Intro (optional), first Verse, first Chorus, and Bridge
function extractEssentialSections(lyrics: string, songTitle: string, genre: string): string {
  const normalizedLyrics = lyrics
    .replace(/\[verse\s*\d*\]/gi, '[Verse]')
    .replace(/\[chorus\s*\d*\]/gi, '[Chorus]')
    .replace(/\[bridge\s*\d*\]/gi, '[Bridge]')
    .replace(/\[pre-?chorus\s*\d*\]/gi, '[Pre-Chorus]')
    .replace(/\[outro\]/gi, '[Outro]')
    .replace(/\[intro\]/gi, '[Intro]')
    .replace(/\[hook\]/gi, '[Hook]')

  // Check if lyrics have section markers
  const hasMarkers = /\[(Verse|Chorus|Bridge|Intro|Hook)\]/i.test(normalizedLyrics)
  
  if (!hasMarkers) {
    // No markers - take first ~400 chars and add basic structure
    const lines = lyrics.split('\n').filter(l => l.trim()).slice(0, 8)
    if (lines.length === 0) return generatePlaceholderLyrics(songTitle, genre)
    
    const verse = lines.slice(0, 4).join('\n')
    const chorus = lines.slice(4, 8).join('\n') || lines.slice(0, 2).join('\n')
    
    return `[Verse]\n${verse}\n\n[Chorus]\n${chorus}`
  }

  // Extract sections
  const sections: { type: string; content: string }[] = []
  const sectionRegex = /\[(Intro|Verse|Chorus|Bridge|Pre-Chorus|Hook)\]([\s\S]*?)(?=\[|$)/gi
  let match

  while ((match = sectionRegex.exec(normalizedLyrics)) !== null) {
    const type = match[1]
    const content = match[2].trim()
    if (content) {
      sections.push({ type, content })
    }
  }

  // Build essential output: Intro (if exists) + first Verse + first Chorus + first Bridge
  const result: string[] = []
  let hasIntro = false
  let hasVerse = false
  let hasChorus = false
  let hasBridge = false

  for (const section of sections) {
    const typeLower = section.type.toLowerCase()
    
    if (typeLower === 'intro' && !hasIntro) {
      // Take only first 2 lines of intro
      const introLines = section.content.split('\n').slice(0, 2).join('\n')
      result.push(`[Intro]\n${introLines}`)
      hasIntro = true
    } else if (typeLower === 'verse' && !hasVerse) {
      // Take only first 4 lines of verse
      const verseLines = section.content.split('\n').slice(0, 4).join('\n')
      result.push(`[Verse]\n${verseLines}`)
      hasVerse = true
    } else if (typeLower === 'chorus' && !hasChorus) {
      // Take only first 4 lines of chorus
      const chorusLines = section.content.split('\n').slice(0, 4).join('\n')
      result.push(`[Chorus]\n${chorusLines}`)
      hasChorus = true
    } else if (typeLower === 'bridge' && !hasBridge) {
      // Take only first 2 lines of bridge
      const bridgeLines = section.content.split('\n').slice(0, 2).join('\n')
      result.push(`[Bridge]\n${bridgeLines}`)
      hasBridge = true
    }

    // Stop if we have all essential sections
    if (hasVerse && hasChorus) break
  }

  // Fallback if no sections found
  if (result.length === 0) {
    return generatePlaceholderLyrics(songTitle, genre)
  }

  return result.join('\n\n')
}

// Generate placeholder lyrics when none exist
function generatePlaceholderLyrics(songTitle: string, genre: string): string {
  const titleWords = songTitle.split(' ').slice(0, 3).join(' ')
  
  return `[Verse]
${titleWords}
Feel the rhythm tonight
${titleWords}
Everything feels right

[Chorus]
${titleWords}
${titleWords}`
}
