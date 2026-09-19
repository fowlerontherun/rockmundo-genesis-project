import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

/** Turn a Google Drive share link into a gateway download request, or pass a plain URL through. */
async function fetchSource(sourceUrl: string): Promise<Response> {
  const driveId =
    sourceUrl.match(/\/file\/d\/([^/]+)/)?.[1] ??
    sourceUrl.match(/[?&]id=([^&]+)/)?.[1] ??
    (/^[A-Za-z0-9_-]{20,}$/.test(sourceUrl) ? sourceUrl : null);

  if (driveId) {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!lovableKey || !driveKey) throw new Error("Google Drive is not connected, so the master cannot be read.");
    return await fetch(`${DRIVE_GATEWAY}/files/${driveId}?alt=media`, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey },
    });
  }

  return await fetch(sourceUrl);
}

async function youtubeAccessToken(): Promise<string> {
  const clientId = Deno.env.get("YOUTUBE_CLIENT_ID");
  const clientSecret = Deno.env.get("YOUTUBE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("YOUTUBE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("YouTube is not set up yet. Add the YouTube channel credentials first.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`[TOTP-YOUTUBE] Token refresh failed [${response.status}]: ${body}`);
    throw new Error(`YouTube sign-in failed (${response.status}): ${body}`);
  }
  const parsed = JSON.parse(body) as { access_token?: string };
  if (!parsed.access_token) throw new Error("YouTube did not return an access token.");
  return parsed.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const service = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  let publicationId: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "You must be signed in." });
    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: { user }, error: authError } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json(401, { error: "You must be signed in." });

    const { data: isAdmin } = await service.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json(403, { error: "Only administrators can publish an episode." });

    const payload = await req.json().catch(() => ({})) as { publicationId?: string };
    publicationId = payload.publicationId ?? null;
    if (!publicationId) return json(400, { error: "No planned upload was provided." });

    const { data: publication, error: loadError } = await service
      .from("totp_youtube_publications")
      .select("*")
      .eq("id", publicationId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!publication) return json(404, { error: "That planned upload no longer exists." });
    if (publication.state === "uploading") return json(409, { error: "That upload is already running." });
    if (publication.state === "published" || publication.state === "scheduled") {
      return json(409, { error: "That episode has already been sent to YouTube." });
    }
    if (!publication.source_url) return json(400, { error: "Add the finished video link before uploading." });

    await service.from("totp_youtube_publications").update({
      state: "uploading",
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", publicationId);

    const accessToken = await youtubeAccessToken();

    const source = await fetchSource(publication.source_url);
    if (!source.ok || !source.body) {
      const detail = source.ok ? "empty response" : await source.text();
      throw new Error(`The finished video could not be read (${source.status}): ${detail}`);
    }
    const contentType = source.headers.get("content-type") ?? "video/*";
    const contentLength = source.headers.get("content-length");

    // A scheduled premiere is a private video with a publishAt time.
    const scheduled = Boolean(publication.publish_at);
    const snippet = {
      title: publication.title.slice(0, 100),
      description: String(publication.description ?? "").slice(0, 5000),
      tags: Array.isArray(publication.tags) ? publication.tags.slice(0, 30) : [],
      categoryId: "10", // Music
    };
    const status = scheduled
      ? { privacyStatus: "private", publishAt: new Date(publication.publish_at as string).toISOString(), selfDeclaredMadeForKids: false }
      : { privacyStatus: publication.privacy_status ?? "private", selfDeclaredMadeForKids: false };

    const initHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": contentType,
    };
    if (contentLength) initHeaders["X-Upload-Content-Length"] = contentLength;

    const init = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      { method: "POST", headers: initHeaders, body: JSON.stringify({ snippet, status }) },
    );
    if (!init.ok) {
      const detail = await init.text();
      throw new Error(`YouTube refused the upload (${init.status}): ${detail}`);
    }
    const uploadUrl = init.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return an upload address.");

    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: contentLength
        ? { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType, "Content-Length": contentLength }
        : { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
      body: source.body,
    });
    const uploadBody = await upload.text();
    if (!upload.ok) {
      console.error(`[TOTP-YOUTUBE] Upload failed [${upload.status}]: ${uploadBody}`);
      throw new Error(`The upload to YouTube failed (${upload.status}): ${uploadBody}`);
    }

    const video = JSON.parse(uploadBody) as { id?: string };
    const videoId = video.id ?? null;
    const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;

    const { data: finished, error: finishError } = await service
      .from("totp_youtube_publications")
      .update({
        state: scheduled ? "scheduled" : "published",
        video_id: videoId,
        watch_url: watchUrl,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", publicationId)
      .select("*")
      .maybeSingle();
    if (finishError) throw new Error(finishError.message);

    await service.from("totp_production_audit").insert({
      episode_id: publication.episode_id,
      event_kind: "publish",
      headline: scheduled ? "Episode scheduled as a YouTube premiere" : "Episode published to YouTube",
      detail: { video_id: videoId, watch_url: watchUrl, publish_at: publication.publish_at },
      passed: true,
      manifest_checksum: publication.manifest_checksum,
      actor_id: user.id,
    });

    return json(200, { publication: finished, videoId, watchUrl, scheduled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("[TOTP-YOUTUBE] Failed:", message);
    if (publicationId) {
      await service.from("totp_youtube_publications").update({
        state: "failed",
        error_message: message.slice(0, 900),
        updated_at: new Date().toISOString(),
      }).eq("id", publicationId);
    }
    return json(500, { error: message });
  }
});
