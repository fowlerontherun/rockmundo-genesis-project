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

    // Check if song already has completed audio or is currently generating
    const { data: existingSong, error: existingSongError } = await supabase
      .from('songs')
      .select('audio_url, audio_generation_status, audio_generation_started_at')
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

    // Race condition guard: prevent duplicate generation attempts
    if (existingSong?.audio_generation_status === 'generating') {
      const startedAt = existingSong.audio_generation_started_at 
        ? new Date(existingSong.audio_generation_started_at) 
        : new Date()
      const elapsed = Date.now() - startedAt.getTime()
      
      // Only allow re-generation if stuck for > 15 minutes
      if (elapsed < 15 * 60 * 1000) {
        console.log(`[generate-song-audio] Generation already in progress for ${songId}, started ${Math.round(elapsed / 1000)}s ago`)
        return new Response(
          JSON.stringify({ 
            error: "Generation already in progress", 
            startedAt: existingSong.audio_generation_started_at,
            message: "Please wait for the current generation to complete"
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
        )
      }
      console.log(`[generate-song-audio] Previous generation appears stuck (${Math.round(elapsed / 60000)} mins), allowing restart`)
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
    // Sanitize lyrics to remove any prompt contamination
    // Track if song originally had lyrics to avoid overwriting user content
    const originalSongLyrics = song.lyrics
    const originalProjectLyrics = project?.lyrics
    let rawLyrics = sanitizeLyrics(song.lyrics) || sanitizeLyrics(project?.lyrics) || null
    const hadOriginalLyrics = !!(originalSongLyrics?.trim() || originalProjectLyrics?.trim())
    const quality = song.quality_score || project?.quality_score || 50
    const durationSeconds = song.duration_seconds || 180

    // Extract from creative_brief if available
    const inspirationAnchor = creativeBrief?.inspirationAnchor || creativeBrief?.inspiration_anchor || null
    const moodPalette = creativeBrief?.moodPalette || creativeBrief?.mood_palette || []

    // Clean profanity from song title before using in prompt
    const cleanedSongTitle = cleanProfanity(songTitle)
    
    console.log(`[generate-song-audio] Building MiniMax prompt for "${cleanedSongTitle}"`)
    console.log(`[generate-song-audio] Genre: ${primaryGenre}`)
    console.log(`[generate-song-audio] Initial Lyrics Check: ${rawLyrics ? rawLyrics.length + ' chars' : 'NONE'}`)

    // AUTO-GENERATE LYRICS if missing - ensures every song has unique lyrics
    if (!rawLyrics || rawLyrics.trim().length === 0) {
      console.log(`[generate-song-audio] No lyrics found - auto-generating unique AI lyrics...`)
      
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
              theme: themeName ? { name: themeName, mood: themeMood } : 'universal',
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
            console.log(`[generate-song-audio] Successfully generated ${rawLyrics.length} chars of unique lyrics`)
            
            // Only save generated lyrics to song record if it didn't have any originally
            // NEVER overwrite user-entered lyrics from songwriting projects
            if (!hadOriginalLyrics) {
              const { error: lyricsUpdateError } = await supabase
                .from('songs')
                .update({ lyrics: rawLyrics })
                .eq('id', songId)
              
              if (lyricsUpdateError) {
                console.error('[generate-song-audio] Failed to save lyrics to song:', lyricsUpdateError)
              } else {
                console.log('[generate-song-audio] Saved auto-generated lyrics to song record (no original lyrics)')
              }
            } else {
              console.log('[generate-song-audio] Skipping lyrics save - song had original user lyrics')
            }
            // NOTE: We NEVER overwrite songwriting_projects.lyrics - that's the user's original work
          } else {
            console.error('[generate-song-audio] Lyrics response missing lyrics field:', lyricsResult)
          }
        } else {
          const errorText = await lyricsResponse.text()
          console.error('[generate-song-audio] Lyrics generation failed:', lyricsResponse.status, errorText)
        }
      } catch (lyricsError) {
        console.error('[generate-song-audio] Exception during lyrics generation:', lyricsError)
      }
    }
    
    console.log(`[generate-song-audio] Final Lyrics: ${rawLyrics ? rawLyrics.length + ' chars' : 'using placeholder'}`)

    // Primary genre and style (space-separated for YuE genre tags)
    styleParts.push(`${primaryGenre}`)

    // Add gender-based vocal style
    const genderVocalStyle = getGenderVocalStyle(creatorGender)
    if (genderVocalStyle) {
      styleParts.push(genderVocalStyle)
    }

    // Add chord progression context
    if (chordProgression) {
      styleParts.push(`${chordName || chordProgression}`)
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

    // YuE uses space-separated genre tags (not comma-separated)
    let stylePrompt = styleParts.join(' ')
    if (stylePrompt.length < 10) {
      stylePrompt = `${primaryGenre} vocal song`
    }
    console.log(`[generate-song-audio] Genre description: "${stylePrompt}"`)

    // Format lyrics for YuE - uses lowercase [verse], [chorus] tags, no character limit
    const formattedLyrics = formatLyricsForYuE(rawLyrics, cleanedSongTitle, primaryGenre)
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

    // Calculate number of segments (~30s each) based on desired duration
    const numSegments = Math.min(10, Math.max(2, Math.round(durationSeconds / 30)))
    console.log(`[generate-song-audio] Calling Replicate YuE API (${numSegments} segments for ~${numSegments * 30}s)...`)

    // Generate audio using YuE for faithful lyrics reproduction
    const output = await replicate.run(
      "fofr/yue:f45da0cfbe372eb9116e87a1e3519aceb008fd03b0d771d21fb8627bee2b4117",
      {
        input: {
          lyrics: formattedLyrics,
          genre_description: stylePrompt,
          num_segments: numSegments,
          max_new_tokens: 3000,
        }
      }
    )

    console.log(`[generate-song-audio] Replicate output received`)

    if (!output) {
      throw new Error('No audio generated')
    }

    // YuE returns an array of file objects — first element is the full audio
    const outputArray = output as any[]
    const replicateAudioUrl = outputArray?.[0]?.url?.() || (typeof outputArray?.[0] === 'string' ? outputArray[0] : null)

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
    console.log('[generate-song-audio] No lyrics provided, using placeholder')
    return generateVariedPlaceholderLyrics(songTitle, genre)
  }

  // Safety check for prompt contamination
  let processedLyrics = rawLyrics.trim()
  if (processedLyrics.toLowerCase().includes('style:') || processedLyrics.toLowerCase().startsWith('lyrics:')) {
    console.warn('[formatLyricsForYuE] Detected corrupted lyrics input, sanitizing...')
    const sectionMatch = processedLyrics.match(/\[(Verse|Chorus|Bridge|Intro|Hook|Pre-Chorus|Outro)[\s\S]*/i)
    if (sectionMatch) {
      processedLyrics = sectionMatch[0]
    } else {
      return generateVariedPlaceholderLyrics(songTitle, genre)
    }
  }

  // Clean profanity
  const cleanedLyrics = cleanProfanity(processedLyrics)
  
  console.log(`[generate-song-audio] Using actual lyrics: ${cleanedLyrics.length} chars`)

  // Normalize section markers to lowercase for YuE (it expects [verse], [chorus] etc.)
  let normalized = cleanedLyrics
    .replace(/\[Verse\s*(\d*)\]/gi, (_, num) => `[verse]`)
    .replace(/\[Chorus\s*(\d*)\]/gi, (_, num) => `[chorus]`)
    .replace(/\[Bridge\s*(\d*)\]/gi, (_, num) => `[bridge]`)
    .replace(/\[Pre-?Chorus\s*(\d*)\]/gi, (_, num) => `[verse]`)  // YuE doesn't support pre-chorus, map to verse
    .replace(/\[Outro\s*\d*\]/gi, '[outro]')
    .replace(/\[Intro\s*\d*\]/gi, '[verse]')  // YuE recommends starting with [verse], not [intro]
    .replace(/\[Hook\s*\d*\]/gi, '[chorus]')
    .replace(/\[Post-?Chorus\s*\d*\]/gi, '[chorus]')
    // Remove chord annotations and singer markers that waste space
    .replace(/\([A-Gm#b\-\/\s]+\)/g, '')
    .replace(/\((She|He|Both|You|Me)\)\s*/gi, '')

  // Check if there are section markers
  const hasMarkers = /\[(verse|chorus|bridge|outro)\]/i.test(normalized)

  if (!hasMarkers) {
    // No markers - add basic structure
    const lines = normalized.split('\n').filter(l => l.trim())
    if (lines.length === 0) return generateVariedPlaceholderLyrics(songTitle, genre)
    
    const midpoint = Math.ceil(lines.length / 2)
    const verse = lines.slice(0, midpoint).join('\n')
    const chorus = lines.slice(midpoint).join('\n') || lines.slice(0, Math.min(4, lines.length)).join('\n')
    return `[verse]\n${verse}\n\n[chorus]\n${chorus}`
  }

  // Ensure sections are separated by double newlines (YuE requirement)
  normalized = normalized.replace(/\n?\[(verse|chorus|bridge|outro)\]/gi, (match) => `\n\n${match.trim()}`)
  
  // Clean up extra whitespace
  normalized = normalized.replace(/\n{3,}/g, '\n\n').trim()

  // Remove leading newlines before first section
  normalized = normalized.replace(/^\n+/, '')

  console.log(`[generate-song-audio] Formatted lyrics for YuE: ${normalized.length} chars`)
  return normalized
}

// FIXED: Generate more varied placeholder lyrics that don't just repeat the title
function generateVariedPlaceholderLyrics(songTitle: string, genre: string): string {
  const title = songTitle || 'My song'
  
  // Genre-specific placeholder templates
  const templates: Record<string, string> = {
    rock: `[verse]
Standing on the edge of tomorrow
Chasing dreams through the night
${title} running through my veins
Nothing's gonna stop us now

[chorus]
We're alive, we're on fire
${title} takes us higher
Breaking free from all the chains
Nothing's ever gonna be the same`,

    pop: `[verse]
Lights are flashing all around
Dancing to the rhythm of the sound
${title} playing on repeat
Got me moving to the beat

[chorus]
Oh we're shining bright tonight
${title} feels so right
Every moment crystallized
Living for the spotlight`,

    electronic: `[verse]
Synthesizers in the dark
Digital dreams leave their mark
${title} pulses through the air
Electric vibes everywhere

[chorus]
Drop the bass and let it flow
${title} stealing the show
Frequencies align tonight
Dancing in the neon light`,

    country: `[verse]
Down that old dusty road
${title} where the river flows
Sunset painting the sky
Memories of days gone by

[chorus]
This is where I belong
${title} is my song
Simple life and starlit nights
Everything feels just right`,

    hiphop: `[verse]
Coming up from the bottom now
${title} showing them how
Every word I speak is true
Built this dream from nothing new

[chorus]
Yeah we made it to the top
${title} we don't stop
Started from the ground floor
Now we're reaching for more`,
  }

  // Find matching genre or use default
  const genreLower = genre?.toLowerCase() || 'pop'
  for (const [key, template] of Object.entries(templates)) {
    if (genreLower.includes(key)) {
      return template
    }
  }
  
  // Default varied placeholder
  return `[verse]
Walking through the moments of my life
${title} guiding me through the night
Every step I take leads me here
Finding strength and losing fear

[chorus]
This is ${title}
This is where we shine
Breaking through the darkness
One moment at a time`
}
