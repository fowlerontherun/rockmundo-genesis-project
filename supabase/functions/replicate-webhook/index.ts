import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyReplicateAttempt } from "../_shared/replicateWebhookAuth.ts"
import { getMp3DurationSeconds } from "../_shared/mp3Duration.ts"
import { assertSafeGeneratedAudioUrl, readBoundedGeneratedAudio } from "../_shared/boundedAudioDownload.ts"

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

  let verifiedAttemptId: string | null = null
  let verifiedSongId: string | null = null
  let finalizationAttempted = false
  try {
    const prediction = await req.json()
    const url = new URL(req.url)
    
    const songId = url.searchParams.get('songId')
    const attemptId = url.searchParams.get('attemptId')
    const callbackSignature = url.searchParams.get('signature')
    
    console.log(`[replicate-webhook] Received webhook for prediction ${prediction.id}, status: ${prediction.status}`)

    if (!songId) {
      console.error('[replicate-webhook] No songId in webhook URL')
      return new Response(JSON.stringify({ error: 'Missing songId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // No client-provided JWT is required, but every callback must carry a
    // server-signed token tied to the exact song and attempt.
    if (!attemptId || !callbackSignature ||
        !(await verifyReplicateAttempt(attemptId, songId, callbackSignature, supabaseServiceKey))) {
      return new Response(JSON.stringify({ error: "Unauthorized provider callback" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const { data: latest, error: attemptError } = await supabase
      .from('song_generation_attempts')
      .select('id, song_id, prediction_id, status')
      .eq('song_id', songId).order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (attemptError) throw attemptError
    if (!latest || latest.id !== attemptId || latest.status !== 'generating') {
      return new Response(JSON.stringify({ success: true, status: "stale_callback_ignored" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (latest.prediction_id && latest.prediction_id !== prediction.id) {
      return new Response(JSON.stringify({ error: "Prediction mismatch" }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    verifiedAttemptId = attemptId
    verifiedSongId = songId
    console.log(`[replicate-webhook] Verified current attempt ${attemptId} for song: ${songId}`)

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      console.error(`[replicate-webhook] Prediction ${prediction.status}:`, prediction.error)
      
      const { data: failure, error: failureError } = await supabase.rpc(
        'finish_song_generation_atomic', {
          p_song_id: songId, p_attempt_id: attemptId, p_status: 'failed',
          p_error_message: String(prediction.error || prediction.status),
          p_prediction_id: prediction.id,
        })
      if (failureError) throw failureError
      if (!failure?.applied) console.log('[replicate-webhook] Duplicate/stale failure ignored')

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
      throw new Error('Provider marked prediction successful but returned no audio output')
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
      throw new Error('Provider returned output without a usable audio URL')
    }

    // Signed provider URLs may carry sensitive query tokens: do not log them.
    // A successful prediction cannot allocate unlimited remote bytes.
    const validatedAudioUrl = assertSafeGeneratedAudioUrl(replicateAudioUrl)
    const audioResponse = await fetch(validatedAudioUrl)
    const audioBytes = await readBoundedGeneratedAudio(audioResponse)
    console.log(`[replicate-webhook] Audio downloaded: ${(audioBytes.length / 1024 / 1024).toFixed(2)} MB`)

    // Do not assume the requested bitrate is constant: output may use VBR.
    // Measure the actual audio frames and fail closed on invalid/truncated MP3s.
    const { data: song, error: songLookupError } = await supabase
      .from('songs')
      .select('title')
      .eq('id', songId)
      .single()
    if (songLookupError || !song) {
      throw new Error(`Cannot validate generated audio: ${songLookupError?.message || 'song not found'}`)
    }
    const actualSeconds = getMp3DurationSeconds(audioBytes)
    if (actualSeconds === null) {
      throw new Error('Generated audio is not a valid complete MP3 file; keeping any existing audio')
    }
    // The game's song.duration_seconds is NOT the paid audio-clip length.
    // A short radio edit should be 60–90 seconds, irrespective of its
    // songwriting/recording duration. Never trigger a retry from the webhook.
    const minSeconds = 60
    const maxSeconds = 90
    console.log(`[replicate-webhook] Measured audio: song=${songId} actual=${actualSeconds.toFixed(2)}s accepted=60–90s bytes=${audioBytes.length}`)
    if (actualSeconds < minSeconds || actualSeconds > maxSeconds) {
      throw new Error(
        `Generated audio duration ${actualSeconds.toFixed(1)}s is outside the required 60–90s range. Existing audio preserved; manual retry only.`
      )
    }

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

    // #4122: record the validated audio and finalize the exact attempt in one
    // transaction. If the RPC fails, neither record is marked completed.
    finalizationAttempted = true
    const { data: finalization, error: finalizationError } = await supabase.rpc(
      'finish_song_generation_atomic', {
        p_song_id: songId, p_attempt_id: attemptId, p_status: 'completed',
        p_audio_url: audioUrl, p_prediction_id: prediction.id,
      })
    if (finalizationError) throw finalizationError
    if (!finalization?.applied) {
      console.warn('[replicate-webhook] Discarding uploaded output from superseded attempt', { songId, attemptId })
      return new Response(JSON.stringify({ success: true, status: 'stale_callback_ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[replicate-webhook] SUCCESS: Song ${songId} audio saved`)

    return new Response(
      JSON.stringify({ success: true, audioUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[replicate-webhook] Error: song=${verifiedSongId || 'unverified'} attempt=${verifiedAttemptId || 'unverified'}: ${message}`)
    // Persist downstream failures as well as provider-declared failures. The
    // diagnostics screen can now distinguish callback/storage errors from stalls.
    // A transient failure in the atomic finalization RPC must remain
    // retryable. Marking the attempt failed here would make a valid,
    // signed duplicate webhook look stale and strand uploaded audio.
    if (verifiedAttemptId && verifiedSongId && !finalizationAttempted) {
      const { error: failureError } = await supabase.rpc('finish_song_generation_atomic', {
        p_song_id: verifiedSongId, p_attempt_id: verifiedAttemptId,
        p_status: 'failed', p_error_message: message,
      })
      if (failureError) console.error('[replicate-webhook] Failed atomic callback reconciliation:', failureError)
    }
    return new Response(
      JSON.stringify({ error: message, attemptId: verifiedAttemptId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

