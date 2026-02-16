import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Replicate from "https://esm.sh/replicate@0.25.2";
import {
  startJobRun,
  completeJobRun,
  failJobRun,
  safeJson,
  getErrorMessage,
} from "../_shared/job-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Generate a first-frame image using Lovable AI (Gemini image model) */
async function generateImage(prompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Image generation failed:', response.status, errorText);
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) throw new Error('No image generated');
  return imageUrl;
}

async function handleSpriteGeneration(body: any) {
  const { spriteType, characterDescription } = body;
  const prompt = `Create a pixel art sprite of ${characterDescription}, viewed from behind at a rock concert. Retro 16-bit video game style, clean outlines, limited color palette. Character centered on solid bright green (#00FF00) background for chroma key removal. Ultra high resolution.`;

  console.log('Generating sprite:', spriteType, prompt);
  const imageUrl = await generateImage(prompt);
  console.log('Sprite generated successfully');

  return { success: true, imageUrl, spriteType };
}

async function handlePOVClipGeneration(body: any, authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const JOB_NAME = "generate-pov-clips";

  // Verify admin
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) throw new Error("Unauthorized");

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Admin access required");

  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!REPLICATE_API_KEY) throw new Error("REPLICATE_API_KEY not configured");

  const startTime = Date.now();
  const runId = await startJobRun({ jobName: JOB_NAME, functionName: "generate-sprite", supabaseClient: supabase, triggeredBy: "admin" });

  try {
    const { clipIds, batchSize = 3 } = body;

    let query = supabase
      .from("pov_clip_templates")
      .select("*")
      .eq("generation_status", "pending")
      .order("instrument_family", { ascending: true })
      .limit(batchSize);

    if (clipIds?.length) {
      query = supabase.from("pov_clip_templates").select("*").in("id", clipIds).limit(batchSize);
    }

    const { data: clips, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!clips?.length) {
      await completeJobRun({ jobName: JOB_NAME, runId, supabaseClient: supabase, durationMs: Date.now() - startTime, processedCount: 0 });
      return { success: true, message: "No pending clips", processed: 0 };
    }

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const clip of clips) {
      try {
        console.log(`[${JOB_NAME}] Processing: ${clip.instrument_track} / ${clip.variant}`);
        await supabase.from("pov_clip_templates").update({ generation_status: "generating" }).eq("id", clip.id);

        // Generate first frame
        const firstFrameUrl = await generateImage(
          `Generate a cinematic first-person POV 16:9 still image from a musician's perspective on stage. ${clip.generation_prompt || clip.description}. Ultra high resolution, no text or watermarks. MTV2/Kerrang early-2000s aesthetic, grainy, high contrast, handheld camera feel.`
        );

        // Upload thumbnail
        if (firstFrameUrl.startsWith("data:")) {
          const base64Data = firstFrameUrl.split(",")[1];
          const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
          const thumbnailPath = `thumbnails/${clip.id}.png`;
          await supabase.storage.from("pov-clips").upload(thumbnailPath, binaryData, { contentType: "image/png", upsert: true });
          const { data: thumbUrl } = supabase.storage.from("pov-clips").getPublicUrl(thumbnailPath);
          await supabase.from("pov_clip_templates").update({ thumbnail_url: thumbUrl.publicUrl }).eq("id", clip.id);
        }

        // Generate video via Replicate
        const replicate = new Replicate({ auth: REPLICATE_API_KEY });
        const webhookUrl = `${supabaseUrl}/functions/v1/replicate-webhook?clipId=${clip.id}`;

        const prediction = await replicate.predictions.create({
          model: "minimax/video-01-live",
          input: {
            prompt: `${clip.generation_prompt || clip.description}. Smooth subtle camera movement, first-person perspective, concert atmosphere, 5 second loopable clip.`,
            first_frame_image: firstFrameUrl,
          },
          webhook: webhookUrl,
          webhook_events_filter: ["completed"],
        });

        results.push({ clipId: clip.id, instrument: clip.instrument_track, variant: clip.variant, predictionId: prediction.id, status: "generating" });
        successCount++;

        await new Promise((r) => setTimeout(r, 2000));
      } catch (clipError) {
        console.error(`[${JOB_NAME}] Error for ${clip.id}:`, clipError);
        errorCount++;
        await supabase.from("pov_clip_templates").update({ generation_status: "failed", generation_error: getErrorMessage(clipError) }).eq("id", clip.id);
        results.push({ clipId: clip.id, instrument: clip.instrument_track, status: "failed", error: getErrorMessage(clipError) });
      }
    }

    await completeJobRun({ jobName: JOB_NAME, runId, supabaseClient: supabase, durationMs: Date.now() - startTime, processedCount: successCount, errorCount, resultSummary: { results } });
    return { success: true, processed: successCount, errors: errorCount, results };
  } catch (error) {
    await failJobRun({ jobName: JOB_NAME, runId, supabaseClient: supabase, durationMs: Date.now() - startTime, error });
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    let result: any;

    if (action === 'generate-pov-clips') {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Missing authorization");
      result = await handlePOVClipGeneration(body, authHeader);
    } else {
      // Default: sprite generation (legacy)
      result = await handleSpriteGeneration(body);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-sprite:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
