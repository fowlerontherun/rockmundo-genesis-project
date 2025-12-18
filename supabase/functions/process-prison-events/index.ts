import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startJobRun, completeJobRun, failJobRun, getErrorMessage } from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const runId = await startJobRun({
    jobName: "process-prison-events",
    functionName: "process-prison-events",
    supabaseClient: supabase,
  });

  try {
    console.log("[process-prison-events] Starting prison event processing...");
    
    let eventsTriggered = 0;
    let escapesAttempted = 0;
    let escapesSuccessful = 0;

    // Get all active prisoners
    const { data: prisoners, error: prisonerError } = await supabase
      .from("player_imprisonments")
      .select("*, prisons(*)")
      .eq("status", "imprisoned");

    if (prisonerError) throw prisonerError;
    console.log(`[process-prison-events] Processing events for ${prisoners?.length || 0} prisoners`);

    for (const prisoner of prisoners || []) {
      // 25% chance of daily prison event
      if (Math.random() < 0.25) {
        // Get available events for this prisoner's behavior score
        const { data: availableEvents } = await supabase
          .from("prison_events")
          .select("*")
          .eq("is_active", true)
          .or(`behavior_min.is.null,behavior_min.lte.${prisoner.behavior_score}`)
          .or(`behavior_max.is.null,behavior_max.gte.${prisoner.behavior_score}`);

        if (availableEvents && availableEvents.length > 0) {
          // Check which events player hasn't seen (unless common)
          const { data: seenEvents } = await supabase
            .from("player_prison_events")
            .select("event_id")
            .eq("user_id", prisoner.user_id);

          const seenEventIds = new Set((seenEvents || []).map(e => e.event_id));
          
          const eligibleEvents = availableEvents.filter(e => 
            e.is_common || !seenEventIds.has(e.id)
          );

          if (eligibleEvents.length > 0) {
            const selectedEvent = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];

            await supabase.from("player_prison_events").insert({
              user_id: prisoner.user_id,
              imprisonment_id: prisoner.id,
              event_id: selectedEvent.id,
              status: "pending"
            });

            await supabase.from("activity_feed").insert({
              user_id: prisoner.user_id,
              activity_type: "prison_event",
              message: `📋 Prison Event: ${selectedEvent.title}`,
              metadata: { event_id: selectedEvent.id, category: selectedEvent.category }
            });

            eventsTriggered++;
          }
        }
      }

      // Process escape opportunity (very rare - 0.5% base chance)
      const prison = prisoner.prisons;
      const escapeChance = 0.005 * (1 - (prison?.escape_difficulty || 90) / 100);
      
      if (Math.random() < escapeChance && prisoner.escape_attempts < 3) {
        // Check if escape event exists
        const { data: escapeEvents } = await supabase
          .from("prison_events")
          .select("*")
          .eq("category", "escape")
          .eq("is_active", true)
          .limit(1);

        if (escapeEvents && escapeEvents.length > 0) {
          const escapeEvent = escapeEvents[0];

          await supabase.from("player_prison_events").insert({
            user_id: prisoner.user_id,
            imprisonment_id: prisoner.id,
            event_id: escapeEvent.id,
            status: "pending"
          });

          await supabase.from("activity_feed").insert({
            user_id: prisoner.user_id,
            activity_type: "escape_opportunity",
            message: "🚪 An escape opportunity has presented itself...",
            metadata: { event_id: escapeEvent.id }
          });

          escapesAttempted++;
        }
      }

      // Good behavior bonus for writing songs
      if (prisoner.songs_written > 0) {
        const behaviorBonus = Math.min(5, prisoner.songs_written); // +1 per song, max +5/day
        const newBehavior = Math.min(100, prisoner.behavior_score + behaviorBonus);

        await supabase
          .from("player_imprisonments")
          .update({ behavior_score: newBehavior })
          .eq("id", prisoner.id);
      }

      // Daily behavior bonus for staying out of trouble (+2/day)
      await supabase
        .from("player_imprisonments")
        .update({ 
          behavior_score: Math.min(100, prisoner.behavior_score + 2)
        })
        .eq("id", prisoner.id);
    }

    // Process expired pending events
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    await supabase
      .from("player_prison_events")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("triggered_at", oneDayAgo.toISOString());

    await completeJobRun({
      jobName: "process-prison-events",
      runId: runId!,
      supabaseClient: supabase,
      processedCount: prisoners?.length || 0,
      details: { eventsTriggered, escapesAttempted, escapesSuccessful }
    });

    return new Response(
      JSON.stringify({
        success: true,
        prisonersProcessed: prisoners?.length || 0,
        eventsTriggered,
        escapesAttempted,
        escapesSuccessful
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[process-prison-events] Error:", error);
    await failJobRun({
      jobName: "process-prison-events",
      runId: runId!,
      supabaseClient: supabase,
      error
    });
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
