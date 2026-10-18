import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4"
import { signReplicateAttempt } from "../_shared/replicateWebhookAuth.ts"

/**
 * #4305: one claim and at most one provider submission per invocation.
 * The DB gate serializes dispatch between concurrent workers. A dispatching
 * lease is never auto-reclaimed after an ambiguous provider HTTP response:
 * preventing a second paid prediction is more important than throughput.
 */
Deno.serve(async (req) => {
  const json = (value: unknown, status=200) => new Response(JSON.stringify(value), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
  if (req.method !== "POST") return json({error:"Method not allowed"},405)
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  const providerToken = Deno.env.get("REPLICATE_API_KEY")
  const secret = req.headers.get("x-cron-secret")
  if (!url || !key || !secret || secret.length < 32) return json({error:"Unauthorized"},403)
  const db = createClient(url,key)
  const {data:valid,error:authError} = await db.rpc("verify_internal_cron_secret",{p_secret:secret})
  if (authError || valid !== true) return json({error:"Unauthorized"},403)
  if (!providerToken) return json({error:"Provider unavailable; dispatch paused"},503)

  const { data:job, error:claimError } = await db.rpc("claim_ai_song_generation")
  if (claimError) return json({error:"Queue claim failed"},503)
  if (!job) return json({status:"idle"})
  const attemptId = String(job.attempt_id)
  const songId = String(job.song_id)

  const fail = async (reason:string) => {
    // An ambiguous network error must NEVER be retried automatically.
    const {error} = await db.rpc("finish_song_generation_atomic", {
      p_song_id:songId,p_attempt_id:attemptId,p_status:"failed",
      p_error_message:"Queue dispatch failed: "+reason.slice(0,650),
    })
    if(error) console.error("[ai-song-queue] Failure reconciliation error",error.message)
    return json({status:"failed",attemptId,reason:"Unable to submit to provider"})
  }
  try {
    const signature=await signReplicateAttempt(attemptId,songId,key)
    const webhook = url + "/functions/v1/replicate-webhook?songId="+encodeURIComponent(songId)
      +"&attemptId="+encodeURIComponent(attemptId)+"&signature="+encodeURIComponent(signature)
    const model=job.model==="music-2.6"?"music-2.6":"music-1.5"
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),25000)
    let response:Response
    try {
      response=await fetch("https://api.replicate.com/v1/models/minimax/"+model+"/predictions",{
        method:"POST",signal:controller.signal,
        headers:{"Authorization":"Bearer "+providerToken,"Content-Type":"application/json"},
        body:JSON.stringify({
          input:{
            prompt:job.style_prompt,lyrics:job.lyrics,bitrate:128000,audio_format:"mp3",
            ...(model==="music-2.6"?{is_instrumental:false,lyrics_optimizer:false}:{}),
          },
          webhook,
          webhook_events_filter:["completed","output"],
        }),
      })
    } finally {clearTimeout(timeout)}
    // Replicate 429 is an explicit rejection BEFORE prediction acceptance.
    // No prediction ID means a bounded retry is safe without another charge.
    if (response.status===429) {
      const detail=await response.text().catch(()=>"Throttled")
      const match=detail.match(/(?:resets in|in)\s*~?(\d+)s/i)
      const retryAfterHeader=Number(response.headers.get("retry-after"))
      const delay=Number.isFinite(retryAfterHeader)&&retryAfterHeader>0
        ? Math.min(3600,Math.max(90,retryAfterHeader))
        : Math.min(3600,Math.max(90,match?Number(match[1])+15:120))
      const {data:requeued,error:requeueError}=await db.rpc("requeue_ai_song_throttled",{
        p_attempt:attemptId,p_delay_seconds:delay,p_error:"Replicate rate-limited submission",
      })
      if (!requeueError && requeued===true) return json({status:"queued",reason:"provider_throttle",retrySeconds:delay})
      return await fail("Provider throttle exceeded bounded retries")
    }
    if (!response.ok) {
      // A 5xx or interrupted POST may have been accepted. Fail closed, never
      // blindly re-submit and incur a second paid prediction.
      const detail=await response.text().catch(()=>"No provider response")
      return await fail("Provider HTTP "+response.status+": "+detail.slice(0,140))
    }
    const prediction=await response.json().catch(()=>null)
    if (!prediction?.id || typeof prediction.id!=="string") {
      return await fail("Provider responded without a prediction ID (manual reconciliation needed)")
    }
    const {data:marked,error:markError}=await db.rpc("mark_ai_song_submitted",{
      p_attempt:attemptId,p_prediction:prediction.id,
    })
    if (markError) {
      console.error("[ai-song-queue] Prediction tracking failed; no resubmission",{
        attemptId,error:markError.message,
      })
      return json({status:"reconciliation_required",attemptId},503)
    }
    if (!marked) {
      // Signed callback can beat prediction-ID persistence.
      return json({status:"already_finalized_or_reconciliation_required",attemptId})
    }
    console.log("[ai-song-queue] Provider prediction accepted",{songId,attemptId})
    return json({status:"submitted",attemptId})
  } catch (error) {
    console.error("[ai-song-queue] Ambiguous provider request outcome",{
      attemptId,reason:error instanceof Error?error.message:"unknown",
    })
    return await fail("Ambiguous provider response; never automatically resubmit")
  }
})
