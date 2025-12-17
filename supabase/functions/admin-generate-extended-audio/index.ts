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

    const { songId } = await req.json()

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
      console.log(`[admin-generate-extended-audio] ${message}`)
    }

    addLog(`Starting EXTENDED (5-minute) audio generation for song ${songId}`)

    // Get song with full metadata
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('*, bands(name, artist_name)')
      .eq('id', songId)
      .single()
    
    if (songError || !song) {
      addLog(`ERROR: Song not found - ${songError?.message}`)
      return new Response(
        JSON.stringify({ error: 'Song not found', logs }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    addLog(`Found song: "${song.title}" by ${song.bands?.name || 'Unknown'}`)

    // Get songwriting project for full lyrics
    let fullLyrics = ''
    let project: any = null
    
    if (song.songwriting_project_id) {
      const { data: projectData } = await supabase
        .from('songwriting_projects')
        .select(`
          lyrics,
          creative_brief,
          genres,
          chord_progressions (name, progression),
          song_themes (name, mood, description)
        `)
        .eq('id', song.songwriting_project_id)
        .single()
      
      project = projectData
      fullLyrics = projectData?.lyrics || ''
      addLog(`Found project with ${fullLyrics.length} chars of lyrics`)
    }

    // Get creator's gender for vocal style
    let creatorGender: string | null = null
    if (song.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gender')
        .eq('user_id', song.user_id)
        .single()
      creatorGender = profile?.gender || null
    }

    // Build extended prompt - use original audio_prompt as base
    const basePrompt = song.audio_prompt || `${song.genre || 'pop'} song`
    
    // Add extended version quality markers
    let extendedPrompt = basePrompt
    if (!extendedPrompt.includes('full length')) {
      extendedPrompt += ', full length version, extended arrangement'
    }
    if (!extendedPrompt.includes('polished')) {
      extendedPrompt += ', polished production, radio quality'
    }

    addLog(`Extended prompt: "${extendedPrompt.substring(0, 100)}..."`)

    // Format full lyrics (not truncated) for extended version
    const formattedLyrics = formatFullLyrics(fullLyrics, song.title, song.genre || 'pop')
    addLog(`Full lyrics formatted: ${formattedLyrics.length} chars`)

    // Initialize Replicate
    addLog('Initializing Replicate API for extended generation...')
    const replicate = new Replicate({ auth: REPLICATE_API_KEY })

    // Extended version: 5 minutes (300 seconds), higher bitrate
    const extendedDuration = 300
    addLog(`Generating ${extendedDuration}s extended version with 256kbps bitrate...`)
    
    const startTime = Date.now()
    
    const output = await replicate.run(
      "minimax/music-1.5",
      {
        input: {
          lyrics: formattedLyrics,
          prompt: extendedPrompt.substring(0, 300),
          song_duration: extendedDuration,
          bitrate: 256000, // Higher quality for streaming release
          sample_rate: 44100
        }
      }
    )

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
    addLog(`Replicate API completed in ${elapsedTime}s`)

    const audioUrl = typeof output === 'string' ? output : (output as any)?.audio || (output as any)?.[0]

    if (!audioUrl) {
      addLog('ERROR: No audio URL in response')
      throw new Error('No audio URL generated')
    }

    addLog(`Extended audio URL received: ${audioUrl.substring(0, 50)}...`)

    // Update song with extended audio URL
    addLog('Saving extended audio URL to database...')
    const { error: updateError } = await supabase
      .from('songs')
      .update({
        extended_audio_url: audioUrl,
        extended_audio_generated_at: new Date().toISOString()
      })
      .eq('id', songId)

    if (updateError) {
      addLog(`ERROR: Failed to save - ${updateError.message}`)
      throw new Error('Failed to save extended audio URL')
    }

    addLog('SUCCESS: Extended audio generation complete!')

    return new Response(
      JSON.stringify({ 
        success: true, 
        extendedAudioUrl: audioUrl,
        songTitle: song.title,
        logs,
        generationTimeSeconds: elapsedTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-generate-extended-audio] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

// Format full lyrics without truncation for extended version
function formatFullLyrics(lyrics: string, title: string, genre: string): string {
  if (!lyrics || lyrics.trim().length === 0) {
    // Generate extended placeholder
    return `[Intro]
${title}

[Verse 1]
${title}
Feel the rhythm tonight
Moving through the air
${title}

[Chorus]
${title}, ${title}
Let it take you higher
${title}, ${title}
Feel the fire

[Verse 2]
Second verse begins
The story continues on
Every word we sing
The melody lives on

[Chorus]
${title}, ${title}
Let it take you higher
${title}, ${title}
Feel the fire

[Bridge]
Break it down now
Feel the sound now
All around now
${title}

[Chorus]
${title}, ${title}
Let it take you higher
${title}, ${title}
Feel the fire

[Outro]
${title}
Fade away`
  }

  // Normalize section markers
  let normalized = lyrics
    .replace(/\[verse\s*\d*\]/gi, '[Verse]')
    .replace(/\[chorus\s*\d*\]/gi, '[Chorus]')
    .replace(/\[bridge\s*\d*\]/gi, '[Bridge]')
    .replace(/\[pre-?chorus\s*\d*\]/gi, '[Pre-Chorus]')
    .replace(/\[outro\]/gi, '[Outro]')
    .replace(/\[intro\]/gi, '[Intro]')
    .replace(/\[hook\]/gi, '[Hook]')

  // If no markers, add basic structure
  if (!/\[(Verse|Chorus|Bridge|Intro)\]/i.test(normalized)) {
    const lines = lyrics.split('\n').filter(l => l.trim())
    const chunks = []
    for (let i = 0; i < lines.length; i += 4) {
      chunks.push(lines.slice(i, i + 4).join('\n'))
    }
    
    let structured = '[Verse 1]\n' + (chunks[0] || title)
    if (chunks[1]) structured += '\n\n[Chorus]\n' + chunks[1]
    if (chunks[2]) structured += '\n\n[Verse 2]\n' + chunks[2]
    if (chunks[3]) structured += '\n\n[Bridge]\n' + chunks[3]
    if (chunks[4]) structured += '\n\n[Chorus]\n' + chunks[4]
    
    return structured
  }

  return normalized
}
