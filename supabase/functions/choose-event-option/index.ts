import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { playerEventId, choice } = await req.json();

    if (!playerEventId || !choice || !["a", "b"].includes(choice)) {
      return new Response(JSON.stringify({ error: "Invalid request. Requires playerEventId and choice (a or b)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[choose-event-option] User ${user.id} choosing option ${choice} for event ${playerEventId}`);

    // Get the player event
    const { data: playerEvent, error: fetchError } = await supabase
      .from("player_events")
      .select(`
        *,
        random_events (*)
      `)
      .eq("id", playerEventId)
      .eq("user_id", user.id)
      .eq("status", "pending_choice")
      .single();

    if (fetchError || !playerEvent) {
      return new Response(JSON.stringify({ error: "Event not found or already processed" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the event with choice
    const { error: updateError } = await supabase
      .from("player_events")
      .update({
        choice_made: choice,
        choice_made_at: new Date().toISOString(),
        status: "awaiting_outcome",
      })
      .eq("id", playerEventId);

    if (updateError) {
      console.error(`[choose-event-option] Failed to update event:`, updateError);
      return new Response(JSON.stringify({ error: "Failed to record choice" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add to event history if not common
    const event = playerEvent.random_events;
    if (event && !event.is_common) {
      await supabase
        .from("player_event_history")
        .upsert({
          user_id: user.id,
          event_id: event.id,
          first_seen_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,event_id",
          ignoreDuplicates: true,
        });
    }

    // Log activity
    await supabase.from("activity_feed").insert({
      user_id: user.id,
      activity_type: "random_event_choice",
      message: `Made a choice: "${choice === "a" ? event?.option_a_text : event?.option_b_text}"`,
      metadata: { event_id: event?.id, choice },
    });

    console.log(`[choose-event-option] Choice recorded successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Choice recorded. Outcome will be applied tomorrow.",
        event_title: event?.title,
        choice_text: choice === "a" ? event?.option_a_text : event?.option_b_text,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[choose-event-option] Error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
