import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EurovisionAction = "get-event" | "submit-entry" | "cast-vote" | "advance-phase";

interface EurovisionRequest {
  action: EurovisionAction;
  eventId?: string;
  entryId?: string;
  bandId?: string;
  songId?: string;
  country?: string;
  voterId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EurovisionRequest = await req.json();

    if (!payload.action) {
      return jsonError("Missing action", 400);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (payload.action) {
      case "get-event":
        return handleGetEvent(supabaseClient);
      case "submit-entry":
        return handleSubmitEntry(supabaseClient, payload);
      case "cast-vote":
        return handleCastVote(supabaseClient, payload);
      case "advance-phase":
        return handleAdvancePhase(supabaseClient, payload);
      default:
        return jsonError("Unsupported action", 400);
    }
  } catch (error) {
    console.error("[eurovision] Error:", error);
    return jsonError("Internal server error", 500);
  }
});

async function handleGetEvent(supabaseClient: ReturnType<typeof createClient>) {
  const { data: event, error } = await supabaseClient
    .from("eurovision_events")
    .select("*")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 400);
  }

  if (!event) {
    return jsonResponse({ event: null, entries: [] });
  }

  const { data: entries } = await supabaseClient
    .from("eurovision_entries")
    .select(`
      id, event_id, band_id, song_id, country, vote_count, final_rank,
      band:bands(name, logo_url),
      song:songs(title, audio_url)
    `)
    .eq("event_id", event.id)
    .order("vote_count", { ascending: false });

  return jsonResponse({ event, entries: entries || [] });
}

async function handleSubmitEntry(
  supabaseClient: ReturnType<typeof createClient>,
  payload: EurovisionRequest
) {
  const { eventId, bandId, songId, country } = payload;

  if (!eventId || !bandId || !songId || !country) {
    return jsonError("Missing required fields: eventId, bandId, songId, country", 400);
  }

  // Verify event is in submissions phase
  const { data: event } = await supabaseClient
    .from("eurovision_events")
    .select("status")
    .eq("id", eventId)
    .single();

  if (!event || event.status !== "submissions") {
    return jsonError("Submissions are not open", 400);
  }

  // Check if band already has an entry
  const { data: existingEntry } = await supabaseClient
    .from("eurovision_entries")
    .select("id")
    .eq("event_id", eventId)
    .eq("band_id", bandId)
    .maybeSingle();

  if (existingEntry) {
    return jsonError("Band already has an entry for this event", 409);
  }

  // Check if country is taken
  const { data: countryEntry } = await supabaseClient
    .from("eurovision_entries")
    .select("id")
    .eq("event_id", eventId)
    .eq("country", country)
    .maybeSingle();

  if (countryEntry) {
    return jsonError("Country already has a representative", 409);
  }

  const { data: entry, error } = await supabaseClient
    .from("eurovision_entries")
    .insert({ event_id: eventId, band_id: bandId, song_id: songId, country })
    .select()
    .single();

  if (error) {
    return jsonError(error.message, 400);
  }

  return jsonResponse({ success: true, entry });
}

async function handleCastVote(
  supabaseClient: ReturnType<typeof createClient>,
  payload: EurovisionRequest
) {
  const { entryId, voterId } = payload;

  if (!entryId || !voterId) {
    return jsonError("Missing required fields: entryId, voterId", 400);
  }

  // Verify entry exists and event is in voting phase
  const { data: entry } = await supabaseClient
    .from("eurovision_entries")
    .select("event_id, eurovision_events(status)")
    .eq("id", entryId)
    .single();

  if (!entry || (entry as any).eurovision_events?.status !== "voting") {
    return jsonError("Voting is not open", 400);
  }

  // Check if already voted
  const { data: existingVote } = await supabaseClient
    .from("eurovision_votes")
    .select("id")
    .eq("entry_id", entryId)
    .eq("voter_id", voterId)
    .maybeSingle();

  if (existingVote) {
    return jsonError("Already voted for this entry", 409);
  }

  const { error } = await supabaseClient
    .from("eurovision_votes")
    .insert({ entry_id: entryId, voter_id: voterId });

  if (error) {
    return jsonError(error.message, 400);
  }

  return jsonResponse({ success: true });
}

async function handleAdvancePhase(
  supabaseClient: ReturnType<typeof createClient>,
  payload: EurovisionRequest
) {
  const { eventId } = payload;

  if (!eventId) {
    return jsonError("Missing eventId", 400);
  }

  const { data: event } = await supabaseClient
    .from("eurovision_events")
    .select("status")
    .eq("id", eventId)
    .single();

  if (!event) {
    return jsonError("Event not found", 404);
  }

  const phases = ["submissions", "voting", "complete"];
  const currentIdx = phases.indexOf(event.status);
  
  if (currentIdx >= phases.length - 1) {
    return jsonError("Already at final phase", 400);
  }

  const nextPhase = phases[currentIdx + 1];

  // If advancing to complete, set final ranks
  if (nextPhase === "complete") {
    const { data: entries } = await supabaseClient
      .from("eurovision_entries")
      .select("id, vote_count")
      .eq("event_id", eventId)
      .order("vote_count", { ascending: false });

    if (entries) {
      for (let i = 0; i < entries.length; i++) {
        await supabaseClient
          .from("eurovision_entries")
          .update({ final_rank: i + 1 })
          .eq("id", entries[i].id);
      }
    }
  }

  const { error } = await supabaseClient
    .from("eurovision_events")
    .update({ status: nextPhase })
    .eq("id", eventId);

  if (error) {
    return jsonError(error.message, 400);
  }

  return jsonResponse({ success: true, newPhase: nextPhase });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
