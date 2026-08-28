import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  },
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("Open Mic service configuration is incomplete");
    }
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "You must be signed in to perform at an Open Mic");
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const token = authorization.slice("Bearer ".length);
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) throw new HttpError(401, "Your session has expired. Please sign in again.");

    const body = await req.json();
    const performanceId = typeof body?.performanceId === "string" ? body.performanceId : null;
    const songId = typeof body?.songId === "string" ? body.songId : null;
    const position = Number(body?.position);

    if (!performanceId || !songId || !Number.isInteger(position) || ![1, 2].includes(position)) {
      throw new HttpError(400, "A valid performance, song and setlist position are required");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: performance, error: performanceError } = await admin
      .from("open_mic_performances")
      .select("id,user_id,band_id,status,current_song_position,song_1_id,song_2_id,venue:open_mic_venues(capacity)")
      .eq("id", performanceId)
      .single();

    if (performanceError || !performance) throw new HttpError(404, "Open Mic performance not found");
    if (performance.user_id !== user.id) throw new HttpError(403, "This is not your Open Mic performance");

    const expectedSongId = position === 1 ? performance.song_1_id : performance.song_2_id;
    if (!expectedSongId || songId !== expectedSongId) {
      throw new HttpError(400, "The song does not match this Open Mic setlist position");
    }

    const { data: existingResult, error: existingError } = await admin
      .from("open_mic_song_performances")
      .select("id,performance_score,crowd_response,commentary,created_at")
      .eq("performance_id", performanceId)
      .eq("position", position)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingResult) {
      if (position === 1 && performance.status === "in_progress" && performance.current_song_position < 2) {
        const { error: advanceError } = await admin
          .from("open_mic_performances")
          .update({ current_song_position: 2 })
          .eq("id", performanceId)
          .eq("user_id", user.id)
          .eq("status", "in_progress");
        if (advanceError) throw advanceError;
      }

      return jsonResponse({
        success: true,
        already_processed: true,
        score: existingResult.performance_score,
        crowd_response: existingResult.crowd_response,
        commentary: existingResult.commentary,
        created_at: existingResult.created_at,
      });
    }

    if (performance.status !== "in_progress") {
      throw new HttpError(409, "This Open Mic performance is not currently live");
    }
    if (performance.current_song_position !== position) {
      throw new HttpError(409, "Finish the current Open Mic song before continuing");
    }

    const { data: song, error: songError } = await admin
      .from("songs")
      .select("quality_score")
      .eq("id", expectedSongId)
      .single();
    if (songError || !song) throw new HttpError(404, "Open Mic song not found");

    let bandChemistry = 50;
    if (performance.band_id) {
      const { data: band, error: bandError } = await admin
        .from("bands")
        .select("chemistry_level")
        .eq("id", performance.band_id)
        .maybeSingle();
      if (bandError) throw bandError;
      bandChemistry = band?.chemistry_level ?? 50;
    }

    const venue = Array.isArray(performance.venue) ? performance.venue[0] : performance.venue;
    const qualityScore = song.quality_score ?? 50;
    const venueCapacity = venue?.capacity ?? 75;
    const performanceFactor = 40 + Math.random() * 60;
    let score = (qualityScore * 0.4) + (bandChemistry * 0.2) + (performanceFactor * 0.4);
    if (venueCapacity < 100) score += 5;
    score = Math.min(99.99, Math.max(0, Math.round(score * 100) / 100));

    const crowdResponse = score >= 85
      ? "ecstatic"
      : score >= 70
        ? "enthusiastic"
        : score >= 55
          ? "engaged"
          : score >= 40
            ? "mixed"
            : "disappointed";

    const commentaryOptions: Record<string, string[]> = {
      ecstatic: ["The crowd erupts in applause!", "People are on their feet!", "What an incredible performance!"],
      enthusiastic: ["Great energy from the crowd!", "The audience is really into it!", "Solid performance getting great reactions!"],
      engaged: ["The crowd is nodding along.", "A respectable performance.", "People seem to be enjoying it."],
      mixed: ["Some people are into it, others not so much.", "The reaction is a bit lukewarm.", "A few people check their phones."],
      disappointed: ["The crowd seems distracted.", "Not the best reception.", "Some people head to the bar."],
    };
    const commentary = [commentaryOptions[crowdResponse][Math.floor(Math.random() * 3)]];

    const { data: insertedResult, error: insertError } = await admin
      .from("open_mic_song_performances")
      .upsert({
        performance_id: performanceId,
        song_id: expectedSongId,
        position,
        performance_score: score,
        crowd_response: crowdResponse,
        commentary,
      }, {
        onConflict: "performance_id,position",
        ignoreDuplicates: true,
      })
      .select("id,performance_score,crowd_response,commentary,created_at")
      .maybeSingle();

    if (insertError) throw insertError;

    let result = insertedResult;
    if (!result) {
      const { data: canonicalResult, error: canonicalError } = await admin
        .from("open_mic_song_performances")
        .select("id,performance_score,crowd_response,commentary,created_at")
        .eq("performance_id", performanceId)
        .eq("position", position)
        .single();
      if (canonicalError) throw canonicalError;
      result = canonicalResult;
    }

    if (position === 1) {
      const { error: advanceError } = await admin
        .from("open_mic_performances")
        .update({ current_song_position: 2 })
        .eq("id", performanceId)
        .eq("user_id", user.id)
        .eq("status", "in_progress");
      if (advanceError) throw advanceError;
    }

    console.log("Open Mic song processed", { performanceId, position });
    return jsonResponse({
      success: true,
      already_processed: !insertedResult,
      score: result.performance_score,
      crowd_response: result.crowd_response,
      commentary: result.commentary,
      created_at: result.created_at,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Open Mic song processing failed";
    console.error("Error processing Open Mic song", { status, message });
    return jsonResponse({ error: message }, status);
  }
});
