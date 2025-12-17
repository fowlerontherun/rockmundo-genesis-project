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

    console.log(`[admin-generate-song-audio] Starting generation for song ${songId} by admin ${user.id}`)

    // Get song details
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('*, songwriting_projects(*)')
      .eq('id', songId)
      .single()

    if (songError || !song) {
      console.error('[admin-generate-song-audio] Song fetch error:', songError)
      return new Response(
        JSON.stringify({ error: 'Song not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Update status to generating
    await supabase
      .from('songs')
      .update({ audio_generation_status: 'generating' })
      .eq('id', songId)

    // Build prompt from song metadata or use custom prompt
    let prompt = customPrompt

    if (!prompt) {
      const genre = song.genre || 'pop'
      const theme = song.songwriting_projects?.theme || 'upbeat'
      const quality = song.quality_score || 50

      prompt = `${genre} music, ${theme}`
      
      if (quality >= 80) {
        prompt += ', professional studio quality, polished production'
      } else if (quality >= 60) {
        prompt += ', good quality, clean mix'
      } else if (quality >= 40) {
        prompt += ', decent quality'
      } else {
        prompt += ', demo quality, raw sound'
      }

      const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop']
      const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic']
      
      if (highEnergyGenres.includes(genre.toLowerCase())) {
        prompt += ', high energy, driving beat'
      } else if (lowEnergyGenres.includes(genre.toLowerCase())) {
        prompt += ', mellow, relaxed tempo'
      }
    }

    console.log(`[admin-generate-song-audio] Generated prompt: "${prompt}"`)

    // Save prompt for reference
    await supabase
      .from('songs')
      .update({ audio_prompt: prompt })
      .eq('id', songId)

    // Initialize Replicate
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    const durationSeconds = song.duration_seconds || 180

    // Generate audio using MusicGen
    const output = await replicate.run(
      "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055f2e4c1c6647f95ae8a805c",
      {
        input: {
          prompt: prompt,
          model_version: "stereo-melody-large",
          output_format: "mp3",
          duration: Math.min(30, Math.floor(durationSeconds / 6)),
          normalization_strategy: "peak"
        }
      }
    )

    console.log(`[admin-generate-song-audio] Replicate output:`, output)

    if (!output) {
      throw new Error('No audio generated')
    }

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
      console.error('[admin-generate-song-audio] Update error:', updateError)
      throw new Error('Failed to save audio URL')
    }

    console.log(`[admin-generate-song-audio] Successfully generated audio for song ${songId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl,
        prompt,
        songTitle: song.title 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-generate-song-audio] Error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
