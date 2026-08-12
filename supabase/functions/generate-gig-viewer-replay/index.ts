import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildGigViewerReplay } from "../_shared/gig-viewer-replay/generator.ts";
import { GIG_VIEWER_VERSION } from "../_shared/gig-viewer-replay/constants.ts";
import type { GigReplayCrowdTuning } from "../_shared/gig-viewer-replay/types.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fallbackCrowdTuning: GigReplayCrowdTuning = {
  densityMultiplier: 2,
  depthSpread: 1,
  lateralSpread: 1,
  stagePull: 0,
  randomness: 0,
  fanScale: 1,
  arrivalSpeed: 1,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let gigId = "";
  let replayId: string | null = null;
  try {
    ({ gigId } = await req.json());
    if (!gigId) return response({ error: "missing_gig_id" }, 400);

    const { data: existing, error: existingError } = await supabase
      .from("gig_viewer_replays")
      .select("id,generation_status,event_count,duration_ms,checksum")
      .eq("gig_id", gigId)
      .eq("viewer_version", GIG_VIEWER_VERSION)
      .eq("generation_status", "ready")
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      console.log("[gig-viewer-replay] returned existing", { gigId, replayId: existing.id });
      return response({ success: true, existing: true, replay: existing });
    }

    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("id,status,completed_at,result_ready_at,venue_id,venues!gigs_venue_id_fkey(capacity)")
      .eq("id", gigId)
      .single();
    if (gigError || !gig) return response({ error: "gig_not_found" }, 404);
    if (gig.status !== "completed" || !gig.result_ready_at) return response({ error: "gig_not_completed" }, 409);

    const { data: outcome, error: outcomeError } = await supabase
      .from("gig_outcomes")
      .select("id,completed_at,actual_attendance,overall_rating,net_profit")
      .eq("gig_id", gigId)
      .single();
    if (outcomeError || !outcome) return response({ error: "outcome_not_found" }, 409);

    const { data: settlement, error: settlementError } = await supabase
      .from("gig_commerce_settlements")
      .select("commerce_snapshot")
      .eq("gig_id", gigId)
      .maybeSingle();
    if (settlementError) throw settlementError;
    // Historical completed gigs intentionally remain legacy/unavailable rather
    // than having commerce inferred from today's stock and venue configuration.
    if (!settlement) return response({ error: "commerce_not_settled" }, 409);

    const { data: claim, error: claimError } = await supabase.rpc("claim_gig_viewer_replay_generation", {
      p_gig_id: gigId,
      p_gig_outcome_id: outcome.id,
      p_viewer_version: GIG_VIEWER_VERSION,
    });
    if (claimError) throw claimError;
    if (claim?.alreadyReady || claim?.alreadyGenerating) {
      return response({
        success: true,
        existing: Boolean(claim.alreadyReady),
        generating: Boolean(claim.alreadyGenerating),
        replayId: claim.replayId,
      });
    }
    replayId = claim.replayId;
    console.log("[gig-viewer-replay] generation started", { gigId, outcomeId: outcome.id, replayId });

    const [songsRes, performersRes, crowdSettingsRes] = await Promise.all([
      supabase.from("gig_song_performances").select("id,song_id,performance_item_id,item_type,position,performance_score,crowd_response,song_title,performance_item_name").eq("gig_outcome_id", outcome.id).order("position"),
      supabase.from("gig_performers").select("profile_id,role_or_instrument,lineup_status,profiles:profiles!gig_performers_profile_id_fkey(display_name,username)").eq("gig_id", gigId).order("created_at", { ascending: true }),
      supabase.from("gig_viewer_crowd_settings").select("revision,settings").eq("id", true).maybeSingle(),
    ]);
    if (songsRes.error) throw songsRes.error;
    if (performersRes.error) throw performersRes.error;
    if (!songsRes.data?.length) throw new Error("MISSING_SONGS");

    const performanceItemIds = [...new Set(songsRes.data
      .filter((row: any) => row.performance_item_id)
      .map((row: any) => row.performance_item_id))];
    const performanceItemsById = new Map<string, any>();
    if (performanceItemIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("performance_items_catalog")
        .select("id,name,item_category,required_skill")
        .in("id", performanceItemIds);
      if (itemsError) throw itemsError;
      for (const item of items ?? []) performanceItemsById.set(item.id, item);
    }

    if (crowdSettingsRes.error) {
      console.warn("[gig-viewer-replay] crowd settings unavailable; using fallback", {
        code: crowdSettingsRes.error.code,
        message: crowdSettingsRes.error.message,
      });
    }
    const crowdTuning = (crowdSettingsRes.data?.settings ?? fallbackCrowdTuning) as GigReplayCrowdTuning;
    const crowdTuningRevision = Math.max(1, Number(crowdSettingsRes.data?.revision) || 1);

    const replay = await buildGigViewerReplay({
      replayId,
      gig: {
        id: gig.id,
        completedAt: outcome.completed_at ?? gig.completed_at,
        resultReadyAt: gig.result_ready_at,
        venueCapacity: gig.venues?.capacity ?? null,
        actualAttendance: outcome.actual_attendance,
        overallRating: outcome.overall_rating,
        netProfit: outcome.net_profit,
      },
      outcomeId: outcome.id,
      generatedAt: new Date().toISOString(),
      songs: songsRes.data.map((song: any) => {
        const performanceItem = song.performance_item_id ? performanceItemsById.get(song.performance_item_id) : null;
        return {
          id: song.id,
          songId: song.song_id,
          position: song.position,
          title: song.song_title ?? song.performance_item_name ?? performanceItem?.name ?? "Unknown Song",
          performanceScore: song.performance_score,
          crowdResponse: song.crowd_response,
          itemType: song.item_type ?? (song.performance_item_id ? "performance_item" : "song"),
          performanceItemId: song.performance_item_id,
          performanceItemCategory: performanceItem?.item_category ?? null,
          performanceItemRequiredSkill: performanceItem?.required_skill ?? null,
        };
      }),
      performers: (performersRes.data ?? []).map((performer: any) => ({
        profileId: performer.profile_id,
        displayName: performer.profiles?.display_name ?? performer.profiles?.username ?? "Unknown Performer",
        roleOrInstrument: performer.role_or_instrument,
        lineupStatus: performer.lineup_status,
      })),
    });
    replay.crowdTuning = crowdTuning;
    replay.crowdTuningRevision = crowdTuningRevision;
    replay.commerce = settlement.commerce_snapshot;

    const { error: updateError } = await supabase
      .from("gig_viewer_replays")
      .update({
        event_payload: {
          events: replay.events,
          crowdTuning: replay.crowdTuning,
          crowdTuningRevision: replay.crowdTuningRevision,
          commerce: replay.commerce,
        },
        event_count: replay.events.length,
        duration_ms: replay.durationMs,
        simulation_seed: replay.simulationSeed,
        event_schema_version: replay.eventSchemaVersion,
        generation_status: "ready",
        generation_error_code: null,
        checksum: replay.checksum,
        generated_at: replay.generatedAt,
      })
      .eq("id", replayId);
    if (updateError) throw updateError;

    console.log("[gig-viewer-replay] generation succeeded", {
      gigId,
      outcomeId: outcome.id,
      replayId,
      eventCount: replay.events.length,
      durationMs: replay.durationMs,
      crowdTuningRevision,
    });
    return response({
      success: true,
      existing: false,
      replayId,
      eventCount: replay.events.length,
      durationMs: replay.durationMs,
      checksum: replay.checksum,
      crowdTuningRevision,
    });
  } catch (error) {
    const code = error instanceof Error && error.message.startsWith("INVALID_REPLAY")
      ? "validation_failed"
      : error instanceof Error
        ? error.message.slice(0, 64)
        : "unknown_error";
    console.error("[gig-viewer-replay] generation failed", { gigId, replayId, code });
    if (replayId) {
      await supabase.from("gig_viewer_replays").update({ generation_status: "failed", generation_error_code: code }).eq("id", replayId);
    }
    return response({ error: "replay_generation_failed", code }, 500);
  }
});
