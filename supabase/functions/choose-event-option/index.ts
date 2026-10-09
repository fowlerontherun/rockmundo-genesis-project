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

    // Event status and choice are transitioned atomically by the database.
    // Use the caller's authenticated identity, never the service-role client.
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: selected, error: choiceError } = await userClient.rpc(
      "submit_random_event_choice",
      { p_player_event_id: playerEventId, p_choice: choice },
    );
    if (choiceError || !selected?.success) {
      return new Response(JSON.stringify({ error: choiceError?.message ?? "Event already chosen or unavailable" }), {
        status: choiceError ? 500 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: event } = await supabase.from("random_events")
      .select("id, title, option_a_text, option_b_text")
      .eq("id", selected.event_id).single();

    // Log activity
    await supabase.from("activity_feed").insert({
      user_id: user.id,
      activity_type: "random_event_choice",
      message: `Made a choice: "${choice === "a" ? event?.option_a_text : event?.option_b_text}"`,
      metadata: { event_id: event?.id, choice },
    });

    // Create inbox message about the choice
    await supabase.from("player_inbox").insert({
      user_id: user.id,
      category: "random_event",
      priority: "normal",
      title: `Choice Made: ${event?.title || "Event"}`,
      message: `You chose: "${choice === "a" ? event?.option_a_text : event?.option_b_text}". The outcome will be applied tomorrow.`,
      metadata: { event_id: event?.id, choice },
      action_type: null,
      related_entity_type: "player_event",
      related_entity_id: playerEventId,
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
