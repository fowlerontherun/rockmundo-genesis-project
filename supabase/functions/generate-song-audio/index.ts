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

    // Get song details (separate queries to avoid broken join)
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('*')
      .eq('id', songId)
      .single()

    if (songError || !song) {
      console.error('[generate-song-audio] Song fetch error:', songError)
      throw new Error('Song not found')
    }

    // Get songwriting project if exists
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

    console.log(`[generate-song-audio] Song data retrieved: ${song.title}`)

    // Get creator's gender for vocal style
    let creatorGender: string | null = null
    const { data: profile } = await supabase
      .from('profiles')
      .select('gender')
      .eq('user_id', userId)
      .single()
    creatorGender = profile?.gender || null
    console.log(`[generate-song-audio] Creator gender: ${creatorGender || 'not set'}`)

    // Get band's sound description if song belongs to a band
    let bandSoundDescription: string | null = null
    if (song.band_id) {
      const { data: bandData } = await supabase
        .from('bands')
        .select('sound_description')
        .eq('id', song.band_id)
        .single()
      bandSoundDescription = bandData?.sound_description || null
      if (bandSoundDescription) {
        console.log(`[generate-song-audio] Band sound description found: ${bandSoundDescription.substring(0, 50)}...`)
      }
    }

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
    const creativeBrief = project?.creative_brief as Record<string, any> || {}
    
    // Build comprehensive prompt for MiniMax Music-1.5
    const songTitle = project?.title || song.title || 'Untitled'
    const primaryGenre = song.genre || project?.genres?.[0] || 'pop'
    const chordProgression = project?.chord_progressions?.progression || null
    const chordName = project?.chord_progressions?.name || null
    const themeName = project?.song_themes?.name || null
    const themeMood = project?.song_themes?.mood || null
    const rawLyrics = project?.lyrics || null
    const quality = song.quality_score || project?.quality_score || 50
    const durationSeconds = song.duration_seconds || 180

    // Extract from creative_brief if available
    const inspirationAnchor = creativeBrief?.inspirationAnchor || creativeBrief?.inspiration_anchor || null
    const moodPalette = creativeBrief?.moodPalette || creativeBrief?.mood_palette || []

    console.log(`[generate-song-audio] Building MiniMax prompt for "${songTitle}"`)
    console.log(`[generate-song-audio] Genre: ${primaryGenre}`)
    console.log(`[generate-song-audio] Has Lyrics: ${!!rawLyrics}`)

    // Build the style prompt for MiniMax
    let styleParts: string[] = []

    // Primary genre and style
    styleParts.push(`${primaryGenre}`)

    // Add gender-based vocal style first
    const genderVocalStyle = getGenderVocalStyle(creatorGender)
    if (genderVocalStyle) {
      styleParts.push(genderVocalStyle)
    }

    // Add chord progression context
    if (chordProgression) {
      styleParts.push(`${chordName || chordProgression} progression`)
    }

    // Add band sound description (first 100 chars for relevance)
    if (bandSoundDescription) {
      const truncatedDesc = bandSoundDescription.substring(0, 100).trim()
      styleParts.push(truncatedDesc)
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
    } else if (quality >= 60) {
      styleParts.push('clean mix')
    } else if (quality >= 40) {
      styleParts.push('demo quality')
    } else {
      styleParts.push('lo-fi')
    }

    // Add energy based on genre
    const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop', 'electronic']
    const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic', 'ballad']
    
    if (highEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
      styleParts.push('high energy')
    } else if (lowEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
      styleParts.push('mellow')
    }

    // MiniMax requires prompt between 10-300 characters
    let stylePrompt = styleParts.join(', ')
    if (stylePrompt.length > 300) {
      stylePrompt = stylePrompt.substring(0, 297) + '...'
    } else if (stylePrompt.length < 10) {
      stylePrompt = `${primaryGenre} song with vocals`
    }
    console.log(`[generate-song-audio] Style prompt: "${stylePrompt}"`)

    // Format lyrics with section markers for MiniMax - ONLY essential sections
    const formattedLyrics = formatLyricsForMiniMax(rawLyrics, songTitle, primaryGenre)
    console.log(`[generate-song-audio] Formatted lyrics (${formattedLyrics.length} chars)`)

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
          song_duration: Math.min(240, Math.max(60, durationSeconds)),
          bitrate: 128000,
          sample_rate: 44100
        }
      }
    )

    console.log(`[generate-song-audio] Replicate output received`)

    if (!output) {
      throw new Error('No audio generated')
    }

    // The output is typically a URL to the generated audio
    const replicateAudioUrl = typeof output === 'string' ? output : (output as any)?.audio || (output as any)?.[0]

    if (!replicateAudioUrl) {
      console.error('[generate-song-audio] Unexpected output format:', JSON.stringify(output))
      throw new Error('No audio URL in response')
    }

    console.log(`[generate-song-audio] Replicate URL: ${replicateAudioUrl}`)

    // Download audio from Replicate and upload to Supabase Storage
    console.log(`[generate-song-audio] Downloading audio from Replicate...`)
    const audioResponse = await fetch(replicateAudioUrl)
    
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }
    
    const audioBlob = await audioResponse.blob()
    const audioBuffer = await audioBlob.arrayBuffer()
    const audioBytes = new Uint8Array(audioBuffer)
    
    console.log(`[generate-song-audio] Audio downloaded: ${audioBytes.length} bytes`)
    
    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedTitle = (song.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    const filename = `${songId}/${sanitizedTitle}_${timestamp}.mp3`
    
    console.log(`[generate-song-audio] Uploading to Supabase Storage: music/${filename}`)
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('music')
      .upload(filename, audioBytes, {
        contentType: 'audio/mpeg',
        upsert: true
      })
    
    if (uploadError) {
      console.error('[generate-song-audio] Storage upload error:', uploadError)
      throw new Error(`Failed to upload to storage: ${uploadError.message}`)
    }
    
    console.log(`[generate-song-audio] Upload successful:`, uploadData)
    
    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('music')
      .getPublicUrl(filename)
    
    const audioUrl = publicUrlData.publicUrl
    console.log(`[generate-song-audio] Public URL: ${audioUrl}`)

    // Update song with Supabase storage URL
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
// Includes full song structure with proper sections
function formatLyricsForMiniMax(rawLyrics: string | null, songTitle: string, genre: string): string {
  if (!rawLyrics || rawLyrics.trim().length === 0) {
    return generatePlaceholderLyrics(songTitle, genre)
  }

  return formatFullLyrics(rawLyrics, songTitle, genre)
}

// Format full lyrics preserving song structure
// MiniMax handles longer lyrics well - we preserve as much as possible
function formatFullLyrics(lyrics: string, songTitle: string, genre: string): string {
  // Normalize section markers to consistent format
  let normalizedLyrics = lyrics
    .replace(/\[verse\s*(\d*)\]/gi, (_, num) => `[Verse${num ? ' ' + num : ''}]`)
    .replace(/\[chorus\s*(\d*)\]/gi, (_, num) => `[Chorus${num ? ' ' + num : ''}]`)
    .replace(/\[bridge\s*(\d*)\]/gi, (_, num) => `[Bridge${num ? ' ' + num : ''}]`)
    .replace(/\[pre-?chorus\s*(\d*)\]/gi, (_, num) => `[Pre-Chorus${num ? ' ' + num : ''}]`)
    .replace(/\[outro\s*\d*\]/gi, '[Outro]')
    .replace(/\[intro\s*\d*\]/gi, '[Intro]')
    .replace(/\[hook\s*\d*\]/gi, '[Hook]')
    .replace(/\[post-?chorus\s*\d*\]/gi, '[Post-Chorus]')

  const hasMarkers = /\[(Verse|Chorus|Bridge|Intro|Hook|Pre-Chorus|Outro)\]/i.test(normalizedLyrics)
  
  if (!hasMarkers) {
    // No markers - intelligently structure the lyrics
    const lines = lyrics.split('\n').filter(l => l.trim())
    if (lines.length === 0) return generatePlaceholderLyrics(songTitle, genre)
    
    // Try to create a proper song structure from unmarked lyrics
    if (lines.length <= 8) {
      const verse = lines.slice(0, Math.ceil(lines.length / 2)).join('\n')
      const chorus = lines.slice(Math.ceil(lines.length / 2)).join('\n') || lines.slice(0, 2).join('\n')
      return `[Verse]\n${verse}\n\n[Chorus]\n${chorus}`
    }
    
    // Longer unmarked lyrics - create verse-chorus-verse-chorus structure
    const quarterLength = Math.floor(lines.length / 4)
    return `[Verse 1]\n${lines.slice(0, quarterLength).join('\n')}\n\n[Chorus]\n${lines.slice(quarterLength, quarterLength * 2).join('\n')}\n\n[Verse 2]\n${lines.slice(quarterLength * 2, quarterLength * 3).join('\n')}\n\n[Chorus]\n${lines.slice(quarterLength * 3).join('\n')}`
  }

  // Extract all sections maintaining order
  const sections: { type: string; content: string }[] = []
  const sectionRegex = /\[(Intro|Verse\s*\d*|Chorus\s*\d*|Bridge\s*\d*|Pre-Chorus\s*\d*|Post-Chorus|Hook|Outro)\]([\s\S]*?)(?=\[|$)/gi
  let match

  while ((match = sectionRegex.exec(normalizedLyrics)) !== null) {
    const type = match[1].trim()
    const content = match[2].trim()
    if (content) {
      sections.push({ type, content })
    }
  }

  if (sections.length === 0) {
    return generatePlaceholderLyrics(songTitle, genre)
  }

  // Build output preserving full structure
  // Limit to ~3000 chars total to stay reasonable for the model
  const MAX_CHARS = 3000
  let totalChars = 0
  const result: string[] = []

  for (const section of sections) {
    const sectionText = `[${section.type}]\n${section.content}`
    
    // Check if adding this section would exceed limit
    if (totalChars + sectionText.length > MAX_CHARS) {
      // If we have at least verse and chorus, we can stop
      const hasEssentials = result.some(s => s.toLowerCase().includes('[verse')) && 
                           result.some(s => s.toLowerCase().includes('[chorus'))
      if (hasEssentials) break
      
      // Otherwise, truncate this section to fit
      const remaining = MAX_CHARS - totalChars - 50 // Buffer for section header
      if (remaining > 100) {
        const truncatedContent = section.content.substring(0, remaining).split('\n').slice(0, -1).join('\n')
        if (truncatedContent.trim()) {
          result.push(`[${section.type}]\n${truncatedContent}`)
        }
      }
      break
    }
    
    result.push(sectionText)
    totalChars += sectionText.length + 2 // +2 for newlines
  }

  // Ensure we have at least a verse and chorus
  if (result.length === 0) {
    return generatePlaceholderLyrics(songTitle, genre)
  }

  const output = result.join('\n\n')
  console.log(`[generate-song-audio] Formatted lyrics: ${output.length} chars, ${result.length} sections`)
  return output
}

function generatePlaceholderLyrics(songTitle: string, genre: string): string {
  // Use full title, not truncated
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
