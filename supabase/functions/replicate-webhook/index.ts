import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const prediction = await req.json()
    const url = new URL(req.url)
    
    // Check if this is a POV clip callback
    const clipId = url.searchParams.get('clipId')
    if (clipId) {
      return await handlePOVClipCallback(prediction, clipId, supabase)
    }

    // Otherwise handle song audio callback
    const songId = url.searchParams.get('songId')
    
    console.log(`[replicate-webhook] Received webhook for prediction ${prediction.id}, status: ${prediction.status}`)

    if (!songId) {
      console.error('[replicate-webhook] No songId or clipId in webhook URL')
      return new Response(JSON.stringify({ error: 'Missing songId or clipId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[replicate-webhook] Processing for song: ${songId}`)

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      console.error(`[replicate-webhook] Prediction ${prediction.status}:`, prediction.error)
      
      await supabase
        .from('songs')
        .update({ audio_generation_status: 'failed' })
        .eq('id', songId)

      await supabase
        .from('song_generation_attempts')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: prediction.error || prediction.status
        })
        .eq('song_id', songId)
        .eq('status', 'generating')

      return new Response(JSON.stringify({ success: true, status: 'failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (prediction.status !== 'succeeded') {
      console.log(`[replicate-webhook] Ignoring status: ${prediction.status}`)
      return new Response(JSON.stringify({ success: true, status: prediction.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Prediction succeeded — process the output
    const output = prediction.output
    console.log(`[replicate-webhook] Output type:`, typeof output, Array.isArray(output) ? `array[${output.length}]` : '')

    if (!output) {
      console.error('[replicate-webhook] No output in prediction')
      await supabase.from('songs').update({ audio_generation_status: 'failed' }).eq('id', songId)
      return new Response(JSON.stringify({ error: 'No output' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // YuE returns an array — first element is the full audio URL
    let replicateAudioUrl: string | null = null
    if (Array.isArray(output)) {
      replicateAudioUrl = typeof output[0] === 'string' ? output[0] : output[0]?.url || null
    } else if (typeof output === 'string') {
      replicateAudioUrl = output
    }

    if (!replicateAudioUrl) {
      console.error('[replicate-webhook] Could not extract audio URL from output:', JSON.stringify(output))
      await supabase.from('songs').update({ audio_generation_status: 'failed' }).eq('id', songId)
      return new Response(JSON.stringify({ error: 'No audio URL in output' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[replicate-webhook] Downloading audio from: ${replicateAudioUrl.substring(0, 80)}...`)

    // Download audio from Replicate
    const audioResponse = await fetch(replicateAudioUrl)
    if (!audioResponse.ok) {
      console.error(`[replicate-webhook] Failed to download audio: ${audioResponse.status}`)
      await supabase.from('songs').update({ audio_generation_status: 'failed' }).eq('id', songId)
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    const audioBlob = await audioResponse.blob()
    const audioBuffer = await audioBlob.arrayBuffer()
    const audioBytes = new Uint8Array(audioBuffer)
    console.log(`[replicate-webhook] Audio downloaded: ${(audioBytes.length / 1024 / 1024).toFixed(2)} MB`)

    // Get song title for filename
    const { data: song } = await supabase
      .from('songs')
      .select('title')
      .eq('id', songId)
      .single()

    const sanitizedTitle = (song?.title || 'song').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    const timestamp = Date.now()
    const filename = `${songId}/${sanitizedTitle}_${timestamp}.mp3`

    console.log(`[replicate-webhook] Uploading to Supabase Storage: music/${filename}`)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('music')
      .upload(filename, audioBytes, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('[replicate-webhook] Storage upload error:', uploadError)
      await supabase.from('songs').update({ audio_generation_status: 'failed' }).eq('id', songId)
      throw new Error(`Failed to upload: ${uploadError.message}`)
    }

    console.log(`[replicate-webhook] Upload successful:`, uploadData)

    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('music')
      .getPublicUrl(filename)

    const audioUrl = publicUrlData.publicUrl
    console.log(`[replicate-webhook] Public URL: ${audioUrl}`)

    // Update song record
    const { error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: audioUrl,
        audio_generation_status: 'completed',
        audio_generated_at: new Date().toISOString()
      })
      .eq('id', songId)

    if (updateError) {
      console.error('[replicate-webhook] Failed to update song:', updateError)
      throw new Error(`Failed to update song: ${updateError.message}`)
    }

    // Update any generating attempts to completed
    await supabase
      .from('song_generation_attempts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('song_id', songId)
      .eq('status', 'generating')

    console.log(`[replicate-webhook] SUCCESS: Song ${songId} audio saved`)

    return new Response(
      JSON.stringify({ success: true, audioUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[replicate-webhook] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/** Handle POV clip video callback from Replicate */
async function handlePOVClipCallback(prediction: any, clipId: string, supabase: any) {
  console.log(`[replicate-webhook] POV clip callback for ${clipId}, status: ${prediction.status}`)

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    await supabase.from('pov_clip_templates').update({
      generation_status: 'failed',
      generation_error: prediction.error || prediction.status,
    }).eq('id', clipId)

    return new Response(JSON.stringify({ success: true, status: 'failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (prediction.status !== 'succeeded') {
    return new Response(JSON.stringify({ success: true, status: prediction.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Extract video URL
  const output = prediction.output
  let replicateVideoUrl: string | null = null
  if (Array.isArray(output)) {
    replicateVideoUrl = typeof output[0] === 'string' ? output[0] : output[0]?.url || null
  } else if (typeof output === 'string') {
    replicateVideoUrl = output
  }

  if (!replicateVideoUrl) {
    await supabase.from('pov_clip_templates').update({ generation_status: 'failed', generation_error: 'No video URL in output' }).eq('id', clipId)
    return new Response(JSON.stringify({ error: 'No video URL' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Download and upload video
  const videoResponse = await fetch(replicateVideoUrl)
  if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.status}`)

  const videoBlob = await videoResponse.blob()
  const videoBytes = new Uint8Array(await videoBlob.arrayBuffer())
  console.log(`[replicate-webhook] POV clip video: ${(videoBytes.length / 1024 / 1024).toFixed(2)} MB`)

  const filename = `clips/${clipId}.mp4`
  const { error: uploadError } = await supabase.storage.from('pov-clips').upload(filename, videoBytes, { contentType: 'video/mp4', upsert: true })
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: publicUrlData } = supabase.storage.from('pov-clips').getPublicUrl(filename)

  await supabase.from('pov_clip_templates').update({
    video_url: publicUrlData.publicUrl,
    generation_status: 'completed',
    generation_error: null,
  }).eq('id', clipId)

  console.log(`[replicate-webhook] SUCCESS: POV clip ${clipId} saved`)

  return new Response(JSON.stringify({ success: true, videoUrl: publicUrlData.publicUrl }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}