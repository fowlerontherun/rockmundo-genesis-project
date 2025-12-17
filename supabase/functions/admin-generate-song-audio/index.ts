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

    addLog(`Starting generation for song ${songId} by admin ${user.id}`)

    // Get song details - use explicit FK hint to resolve ambiguous relationship
    addLog('Fetching song details from database...')
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('*, songwriting_projects!songs_songwriting_project_id_fkey(*)')
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
      .update({ audio_generation_status: 'generating' })
      .eq('id', songId)

    // Build prompt from song metadata or use custom prompt
    addLog('Building audio generation prompt...')
    let prompt = customPrompt

    if (!prompt) {
      const genre = song.genre || 'pop'
      const theme = song.songwriting_projects?.theme || 'upbeat'
      const quality = song.quality_score || 50

      addLog(`Using song metadata - Genre: ${genre}, Theme: ${theme}, Quality: ${quality}`)
      
      prompt = `${genre} music, ${theme}`
      
      if (quality >= 80) {
        prompt += ', professional studio quality, polished production'
        addLog('Quality tier: Professional (80+)')
      } else if (quality >= 60) {
        prompt += ', good quality, clean mix'
        addLog('Quality tier: Good (60-79)')
      } else if (quality >= 40) {
        prompt += ', decent quality'
        addLog('Quality tier: Decent (40-59)')
      } else {
        prompt += ', demo quality, raw sound'
        addLog('Quality tier: Demo (<40)')
      }

      const highEnergyGenres = ['rock', 'punk', 'metal', 'edm', 'dance', 'hip-hop']
      const lowEnergyGenres = ['ambient', 'classical', 'jazz', 'folk', 'acoustic']
      
      if (highEnergyGenres.includes(genre.toLowerCase())) {
        prompt += ', high energy, driving beat'
        addLog('Energy level: High')
      } else if (lowEnergyGenres.includes(genre.toLowerCase())) {
        prompt += ', mellow, relaxed tempo'
        addLog('Energy level: Low')
      } else {
        addLog('Energy level: Medium')
      }
    } else {
      addLog('Using custom prompt provided by admin')
    }

    addLog(`Final prompt: "${prompt}"`)

    // Save prompt for reference
    addLog('Saving prompt to database...')
    await supabase
      .from('songs')
      .update({ audio_prompt: prompt })
      .eq('id', songId)

    // Initialize Replicate
    addLog('Initializing Replicate API client...')
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    const durationSeconds = song.duration_seconds || 180
    const audioDuration = Math.min(30, Math.floor(durationSeconds / 6))
    addLog(`Song duration: ${durationSeconds}s, generating ${audioDuration}s audio clip`)

    // Generate audio using MusicGen
    addLog('Calling Replicate MusicGen API (this may take 30-90 seconds)...')
    const startTime = Date.now()
    
    const output = await replicate.run(
      "meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb",
      {
        input: {
          prompt: prompt,
          model_version: "stereo-melody-large",
          output_format: "mp3",
          duration: audioDuration,
          normalization_strategy: "peak"
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

    const audioUrl = typeof output === 'string' ? output : (output as any)[0] || (output as any).audio

    if (!audioUrl) {
      addLog('ERROR: No audio URL found in Replicate response')
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

    addLog('SUCCESS: Audio generation complete!')
    console.log(`[admin-generate-song-audio] Successfully generated audio for song ${songId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        audioUrl,
        prompt,
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
