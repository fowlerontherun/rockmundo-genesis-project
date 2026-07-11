import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildGigViewerReplay } from "../_shared/gig-viewer-replay/generator.ts";
import { GIG_VIEWER_VERSION } from "../_shared/gig-viewer-replay/constants.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let gigId = "";
  let replayId: string | null = null;
  try {
    ({ gigId } = await req.json());
    if (!gigId) return response({ error: "missing_gig_id" }, 400);
    const { data: existing, error: existingError } = await supabase.from("gig_viewer_replays").select("id,generation_status,event_count,duration_ms,checksum").eq("gig_id", gigId).eq("viewer_version", GIG_VIEWER_VERSION).eq("generation_status", "ready").maybeSingle();
    if (existingError) throw existingError;
    if (existing) { console.log("[gig-viewer-replay] returned existing", { gigId, replayId: existing.id }); return response({ success: true, existing: true, replay: existing }); }

    const { data: gig, error: gigError } = await supabase.from("gigs").select("id,status,completed_at,result_ready_at,venue_id,venues!gigs_venue_id_fkey(capacity)").eq("id", gigId).single();
    if (gigError || !gig) return response({ error: "gig_not_found" }, 404);
    if (gig.status !== "completed" || !gig.result_ready_at) return response({ error: "gig_not_completed" }, 409);
    const { data: outcome, error: outcomeError } = await supabase.from("gig_outcomes").select("id,completed_at,actual_attendance,overall_rating,net_profit").eq("gig_id", gigId).single();
    if (outcomeError || !outcome) return response({ error: "outcome_not_found" }, 409);

    const { data: claim, error: claimError } = await supabase.rpc("claim_gig_viewer_replay_generation", { p_gig_id: gigId, p_gig_outcome_id: outcome.id, p_viewer_version: GIG_VIEWER_VERSION });
    if (claimError) throw claimError;
    if (claim?.alreadyReady || claim?.alreadyGenerating) return response({ success: true, existing: Boolean(claim.alreadyReady), generating: Boolean(claim.alreadyGenerating), replayId: claim.replayId });
    replayId = claim.replayId;
    console.log("[gig-viewer-replay] generation started", { gigId, outcomeId: outcome.id, replayId });

    const [songsRes, performersRes] = await Promise.all([
      supabase.from("gig_song_performances").select("id,song_id,position,performance_score,crowd_response,song_title,performance_item_name").eq("gig_outcome_id", outcome.id).order("position"),
      supabase.from("gig_performers").select("profile_id,role_or_instrument,lineup_status,profiles:profiles!gig_performers_profile_id_fkey(display_name,username)").eq("gig_id", gigId).order("created_at", { ascending: true }),
    ]);
    if (songsRes.error) throw songsRes.error;
    if (performersRes.error) throw performersRes.error;
    if (!songsRes.data?.length) throw new Error("MISSING_SONGS");

    const replay = await buildGigViewerReplay({ replayId, gig: { id: gig.id, completedAt: outcome.completed_at ?? gig.completed_at, resultReadyAt: gig.result_ready_at, venueCapacity: gig.venues?.capacity ?? null, actualAttendance: outcome.actual_attendance, overallRating: outcome.overall_rating, netProfit: outcome.net_profit }, outcomeId: outcome.id, generatedAt: new Date().toISOString(), songs: songsRes.data.map((s: any) => ({ id: s.id, songId: s.song_id, position: s.position, title: s.song_title ?? s.performance_item_name ?? "Unknown Song", performanceScore: s.performance_score, crowdResponse: s.crowd_response })), performers: (performersRes.data ?? []).map((p: any) => ({ profileId: p.profile_id, displayName: p.profiles?.display_name ?? p.profiles?.username ?? "Unknown Performer", roleOrInstrument: p.role_or_instrument, lineupStatus: p.lineup_status })) });
    const { error: updateError } = await supabase.from("gig_viewer_replays").update({ event_payload: { events: replay.events }, event_count: replay.events.length, duration_ms: replay.durationMs, simulation_seed: replay.simulationSeed, event_schema_version: replay.eventSchemaVersion, generation_status: "ready", generation_error_code: null, checksum: replay.checksum, generated_at: replay.generatedAt }).eq("id", replayId);
    if (updateError) throw updateError;
    console.log("[gig-viewer-replay] generation succeeded", { gigId, outcomeId: outcome.id, replayId, eventCount: replay.events.length, durationMs: replay.durationMs });
    return response({ success: true, existing: false, replayId, eventCount: replay.events.length, durationMs: replay.durationMs, checksum: replay.checksum });
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("INVALID_REPLAY") ? "validation_failed" : error instanceof Error ? error.message.slice(0, 64) : "unknown_error";
    console.error("[gig-viewer-replay] generation failed", { gigId, replayId, code });
    if (replayId) await supabase.from("gig_viewer_replays").update({ generation_status: "failed", generation_error_code: code }).eq("id", replayId);
    return response({ error: "replay_generation_failed", code }, 500);
  }
});
