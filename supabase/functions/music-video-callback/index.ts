import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyReplicateWebhookSignature } from "../_shared/replicate-signature.ts";

interface ReplicateWebhookPayload {
  id?: string;
  status?: string;
  output?: string | string[] | { video?: string; url?: string };
  error?: string;
}

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
let cachedSigningSecret: string | undefined;

async function getReplicateSigningSecret(): Promise<string> {
  if (cachedSigningSecret) return cachedSigningSecret;
  const local = Deno.env.get("REPLICATE_WEBHOOK_SIGNING_SECRET");
  if (local?.startsWith("whsec_")) {
    cachedSigningSecret = local;
    return local;
  }
  const apiKey = Deno.env.get("REPLICATE_API_KEY");
  if (!apiKey) throw new Error("Replicate signature verification unavailable");
  const response = await fetch("https://api.replicate.com/v1/webhooks/default/secret", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error("Unable to retrieve provider signing key");
  const { key } = await response.json();
  if (typeof key !== "string" || !key.startsWith("whsec_")) {
    throw new Error("Invalid provider signing key");
  }
  cachedSigningSecret = key;
  return key;
}

async function signedByReplicate(req: Request, rawBody: string): Promise<boolean> {
  // Reject obviously unsigned requests before fetching the provider's secret.
  // This prevents arbitrary internet clients from exhausting the signing-key API.
  if (!req.headers.get("webhook-id") || !req.headers.get("webhook-timestamp") ||
      !req.headers.get("webhook-signature")) return false;
  return verifyReplicateWebhookSignature({
    webhookId: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signature: req.headers.get("webhook-signature"),
    rawBody,
    secret: await getReplicateSigningSecret(),
  });
}

function providerUrl(output: ReplicateWebhookPayload["output"]): string | null {
  const value = typeof output === "string" ? output :
    Array.isArray(output) ? output[0] :
    output?.video ?? output?.url;
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value);
    // Replicate's signed result may point to their CDN; never fetch an
    // arbitrary URL or private address from external JSON.
    return url.protocol === "https:" &&
      (url.hostname === "replicate.delivery" || url.hostname.endsWith(".replicate.delivery"))
      ? value : null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    // Authenticate the RAW request before creating any privileged client.
    if (Number(req.headers.get("content-length") ?? 0) > 100_000) {
      return json({ error: "Webhook body too large" }, 413);
    }
    const rawBody = await req.text();
    if (rawBody.length > 100_000 || !await signedByReplicate(req, rawBody)) {
      return json({ error: "Unverified Replicate callback" }, 401);
    }
    const videoId = new URL(req.url).searchParams.get("videoId");
    if (!videoId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(videoId)) {
      return json({ error: "Invalid video ID" }, 400);
    }
    const payload = JSON.parse(rawBody) as ReplicateWebhookPayload;
    if (typeof payload.id !== "string" || payload.id.length < 5 ||
      !["succeeded", "failed", "canceled"].includes(payload.status ?? "")) {
      return json({ error: "Unsupported provider callback" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: attempt, error } = await supabase
      .from("music_video_generation_attempts")
      .select("state,prediction_id")
      .eq("video_id", videoId)
      .maybeSingle();
    if (error) throw error;
    // A signed webhook for a different prediction or old generation
    // must never settle, refund or mutate another video.
    if (!attempt || attempt.prediction_id !== payload.id) {
      return json({ error: "Prediction is not registered for this video" }, 409);
    }
    if (attempt.state === "failed" || attempt.state === "succeeded") {
      return json({ success: true, alreadySettled: true });
    }
    if (attempt.state !== "generating") {
      return json({ error: "Generation not ready for callback" }, 409);
    }

    let permanentUrl: string | null = null;
    if (payload.status === "succeeded") {
      const url = providerUrl(payload.output);
      if (!url) return json({ error: "Unsupported provider video URL" }, 422);
      const fetched = await fetch(url);
      if (!fetched.ok) return json({ error: "Unable to download generated video" }, 503);
      const length = Number(fetched.headers.get("content-length") ?? 0);
      if (length > 100_000_000) return json({ error: "Generated video too large" }, 422);
      const buffer = await fetched.arrayBuffer();
      if (buffer.byteLength > 100_000_000) return json({ error: "Generated video too large" }, 422);
      const filename = `music-videos/${videoId}_${payload.id}.mp4`;
      const { error: uploadError } = await supabase.storage.from("music")
        .upload(filename, buffer, { contentType: "video/mp4", upsert: true });
      if (uploadError) throw uploadError;
      permanentUrl = supabase.storage.from("music").getPublicUrl(filename).data.publicUrl;
    }

    const finalStatus = payload.status === "succeeded" ? "succeeded" : "failed";
    const { data: outcome, error: settleError } = await supabase.rpc(
      "settle_music_video_generation", {
        p_video_id: videoId,
        p_prediction_id: payload.id,
        p_status: finalStatus,
        p_video_url: permanentUrl,
        p_error: finalStatus === "failed" ? (payload.error || "Provider generation failed") : null,
      },
    );
    if (settleError) {
      console.error("[music-video-callback] settlement rejected:", settleError.code);
      return json({ error: "Generation settlement rejected" }, 409);
    }
    return json({ success: true, settled: outcome?.settled === true });
  } catch (error) {
    console.error("[music-video-callback] verified callback failed:", error);
    return json({ error: "Provider callback processing failed" }, 500);
  }
});
