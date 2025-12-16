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

    // Check VIP status
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

    // Get song details
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('*, songwriting_projects(*)')
      .eq('id', songId)
      .single()

    if (songError || !song) {
      console.error('[generate-song-audio] Song fetch error:', songError)
      throw new Error('Song not found')
    }

    // Update status to generating
    await supabase
      .from('songs')
      .update({ audio_generation_status: 'generating' })
      .eq('id', songId)

    // Build prompt from song metadata
    const genre = song.genre || 'pop'
    const theme = song.songwriting_projects?.theme || 'upbeat'
    const quality = song.quality_score || 50
    const durationSeconds = song.duration_seconds || 180

    // Create descriptive prompt for MusicGen
    let prompt = `${genre} music, ${theme}`
    
    if (quality >= 80) {
      prompt += ', professional studio quality, polished production'
    } else if (quality >= 60) {
      prompt += ', good quality, clean mix'
    } else if (quality >= 40) {
      prompt += ', decent quality'
    } else {
      prompt += ', demo quality, raw sound'
    }

    // Add energy based on genre
    const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop']
    const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic']
    
    if (highEnergyGenres.includes(genre.toLowerCase())) {
      prompt += ', high energy, driving beat'
    } else if (lowEnergyGenres.includes(genre.toLowerCase())) {
      prompt += ', mellow, relaxed tempo'
    }

    console.log(`[generate-song-audio] Generated prompt: "${prompt}"`)

    // Save prompt for reference
    await supabase
      .from('songs')
      .update({ audio_prompt: prompt })
      .eq('id', songId)

    // Initialize Replicate
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

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

    console.log(`[generate-song-audio] Replicate output:`, output)

    if (!output) {
      throw new Error('No audio generated')
    }

    // The output is typically a URL to the generated audio
    const audioUrl = typeof output === 'string' ? output : (output as any)[0] || (output as any).audio

    if (!audioUrl) {
      throw new Error('No audio URL in response')
    }

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

    console.log(`[generate-song-audio] Successfully generated audio for song ${songId}`)

    return new Response(
      JSON.stringify({ success: true, audioUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[generate-song-audio] Error:', error)
    
    // Try to update status to failed if we have songId
    try {
      const { songId } = await req.json().catch(() => ({}))
      if (songId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('songs')
          .update({ audio_generation_status: 'failed' })
          .eq('id', songId)
      }
    } catch (e) {
      // Ignore
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
