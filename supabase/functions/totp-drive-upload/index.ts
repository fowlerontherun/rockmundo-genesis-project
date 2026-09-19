import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_drive";
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB safety cap

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // Require a signed-in user so the upload endpoint is not abused.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "You must be signed in to save to Google Drive." });
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(401, { error: "You must be signed in to save to Google Drive." });

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const driveKey = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!lovableKey || !driveKey) return json(500, { error: "Google Drive is not connected yet." });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return json(400, { error: "No video file was provided." });
    if (file.size === 0) return json(400, { error: "The exported file was empty." });
    if (file.size > MAX_UPLOAD_BYTES) return json(413, { error: "The exported file is too large to upload." });

    const fileName = (formData.get("fileName") as string | null)?.trim() || file.name || "top-of-the-pops-export.webm";
    const mimeType = file.type || "video/webm";

    // Multipart upload: metadata part + media part, per Drive API v3.
    const boundary = `totp_upload_${crypto.randomUUID().replaceAll("-", "")}`;
    const metadata = JSON.stringify({ name: fileName, mimeType });
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const encoder = new TextEncoder();
    const head = encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    );
    const tail = encoder.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(head.length + fileBytes.length + tail.length);
    body.set(head, 0);
    body.set(fileBytes, head.length);
    body.set(tail, head.length + fileBytes.length);

    const response = await fetch(`${GATEWAY_URL}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[TOTP-DRIVE-UPLOAD] Gateway failed [${response.status}]: ${errorBody}`);
      return json(response.status, { error: "Google Drive upload failed", status: response.status, details: errorBody });
    }

    const uploaded = await response.json();
    console.log(`[TOTP-DRIVE-UPLOAD] Uploaded ${fileName} (${file.size} bytes) for user ${user.id} -> ${uploaded.id}`);
    return json(200, { id: uploaded.id, name: uploaded.name, webViewLink: uploaded.webViewLink ?? null });
  } catch (error) {
    console.error("[TOTP-DRIVE-UPLOAD] Unexpected error:", error);
    return json(500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});
