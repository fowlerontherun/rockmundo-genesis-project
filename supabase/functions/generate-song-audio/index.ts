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
    
    // Build comprehensive prompt
    const songTitle = project?.title || song.title || 'Untitled'
    const primaryGenre = song.genre || project?.genres?.[0] || 'pop'
    const chordProgression = project?.chord_progressions?.progression || null
    const chordName = project?.chord_progressions?.name || null
    const themeName = project?.song_themes?.name || null
    const themeMood = project?.song_themes?.mood || null
    const themeDescription = project?.song_themes?.description || null
    const lyrics = project?.lyrics || null
    const quality = song.quality_score || project?.quality_score || 50
    const durationSeconds = song.duration_seconds || 180

    // Extract from creative_brief if available
    const inspirationAnchor = creativeBrief?.inspirationAnchor || creativeBrief?.inspiration_anchor || null
    const moodPalette = creativeBrief?.moodPalette || creativeBrief?.mood_palette || []
    const targetAudience = creativeBrief?.targetAudience || creativeBrief?.target_audience || null

    console.log(`[generate-song-audio] Building prompt for "${songTitle}"`)
    console.log(`[generate-song-audio] Genre: ${primaryGenre}`)
    console.log(`[generate-song-audio] Chord Progression: ${chordProgression}`)
    console.log(`[generate-song-audio] Theme: ${themeName} (${themeMood})`)
    console.log(`[generate-song-audio] Inspiration: ${inspirationAnchor}`)
    console.log(`[generate-song-audio] Mood Palette: ${JSON.stringify(moodPalette)}`)

    // Build the comprehensive prompt
    let promptParts: string[] = []

    // Primary genre and style
    promptParts.push(`${primaryGenre} music`)

    // Add chord progression context
    if (chordProgression) {
      promptParts.push(`with ${chordName || chordProgression} chord progression`)
    }

    // Add theme and mood
    if (themeName) {
      promptParts.push(`${themeName} theme`)
    }
    if (themeMood) {
      promptParts.push(`${themeMood} mood`)
    }
    if (themeDescription) {
      promptParts.push(themeDescription)
    }

    // Add mood palette
    if (Array.isArray(moodPalette) && moodPalette.length > 0) {
      promptParts.push(moodPalette.join(', '))
    }

    // Add inspiration anchor
    if (inspirationAnchor) {
      promptParts.push(`inspired by ${inspirationAnchor}`)
    }

    // Add lyrical context (instrumental version reference)
    if (lyrics && lyrics.length > 0) {
      // Extract key emotional words from lyrics for instrumental mood
      const lyricsPreview = lyrics.substring(0, 200)
      const emotionalWords = extractEmotionalWords(lyricsPreview)
      if (emotionalWords.length > 0) {
        promptParts.push(`emotional undertones of ${emotionalWords.join(', ')}`)
      }
    }

    // Add quality descriptors
    if (quality >= 80) {
      promptParts.push('professional studio quality, polished production, rich arrangement')
    } else if (quality >= 60) {
      promptParts.push('good quality, clean mix, balanced')
    } else if (quality >= 40) {
      promptParts.push('decent quality, demo production')
    } else {
      promptParts.push('raw demo quality, lo-fi')
    }

    // Add energy based on genre
    const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop', 'electronic']
    const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic', 'ballad']
    
    if (highEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
      promptParts.push('high energy, driving beat, dynamic')
    } else if (lowEnergyGenres.some(g => primaryGenre.toLowerCase().includes(g))) {
      promptParts.push('mellow, relaxed tempo, atmospheric')
    }

    // Note: MusicGen is instrumental only
    promptParts.push('instrumental')

    const prompt = promptParts.join(', ')
    console.log(`[generate-song-audio] Final prompt: "${prompt}"`)

    // Save prompt for reference
    await supabase
      .from('songs')
      .update({ audio_prompt: prompt })
      .eq('id', songId)

    // Update attempt with prompt
    if (attempt?.id) {
      await supabase
        .from('song_generation_attempts')
        .update({ prompt_used: prompt })
        .eq('id', attempt.id)
    }

    // Initialize Replicate
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    console.log(`[generate-song-audio] Calling Replicate MusicGen API...`)

    // Generate audio using MusicGen
    const output = await replicate.run(
      "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055f2e4c1c6647f95ae8a805c",
      {
        input: {
          prompt: prompt,
          model_version: "stereo-melody-large",
          output_format: "mp3",
          duration: Math.min(30, Math.floor(durationSeconds / 6)), // Max 30 seconds for demo
          normalization_strategy: "peak"
        }
      }
    )

    console.log(`[generate-song-audio] Replicate output received`)

    if (!output) {
      throw new Error('No audio generated')
    }

    // The output is typically a URL to the generated audio
    const audioUrl = typeof output === 'string' ? output : (output as any)[0] || (output as any).audio

    if (!audioUrl) {
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

    console.log(`[generate-song-audio] Successfully generated audio for song ${songId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl,
        message: `Audio generated for "${songTitle}"`
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

// Helper function to extract emotional words from lyrics
function extractEmotionalWords(text: string): string[] {
  const emotionalKeywords = [
    'love', 'heart', 'soul', 'dream', 'hope', 'pain', 'joy', 'tears', 
    'fire', 'light', 'dark', 'night', 'day', 'sun', 'moon', 'star',
    'free', 'lost', 'found', 'break', 'fall', 'rise', 'fly', 'dance',
    'sing', 'cry', 'laugh', 'smile', 'fear', 'brave', 'strong', 'weak',
    'wild', 'peace', 'war', 'fight', 'surrender', 'believe', 'forever',
    'lonely', 'together', 'apart', 'close', 'far', 'home', 'away'
  ]
  
  const words = text.toLowerCase().split(/\W+/)
  const found = words.filter(word => emotionalKeywords.includes(word))
  return [...new Set(found)].slice(0, 5) // Max 5 unique emotional words
}
