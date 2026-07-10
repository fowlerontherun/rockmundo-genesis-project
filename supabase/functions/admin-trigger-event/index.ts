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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "No authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: roleError } = await supabaseUser.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, eventId, category } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-trigger-event] Triggering event for user ${userId}, eventId: ${eventId}, category: ${category}`);

    // Check if player already has a pending event
    const { data: pendingEvents } = await supabase
      .from("player_events")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["pending_choice", "awaiting_outcome"])
      .limit(1);

    if (pendingEvents && pendingEvents.length > 0) {
      return new Response(
        JSON.stringify({ error: "Player already has a pending event", pendingEventId: pendingEvents[0].id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get player's health for filtering
    const { data: player } = await supabase
      .from("profiles")
      .select("health")
      .eq("user_id", userId)
      .single();

    const playerHealth = player?.health ?? 100;

    let selectedEvent;

    if (eventId) {
      // Specific event requested
      const { data: event, error } = await supabase
        .from("random_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error || !event) {
        return new Response(
          JSON.stringify({ error: "Event not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      selectedEvent = event;
    } else {
      // Random event - optionally filtered by category
      let query = supabase
        .from("random_events")
        .select("*")
        .eq("is_active", true);

      if (category && category !== "all") {
        query = query.eq("category", category);
      }

      const { data: events, error } = await query;

      if (error) throw error;

      // Filter by health conditions
      const eligibleEvents = (events || []).filter((event) => {
        if (event.health_min !== null && playerHealth < event.health_min) {
          return false;
        }
        if (event.health_max !== null && playerHealth > event.health_max) {
          return false;
        }
        return true;
      });

      if (eligibleEvents.length === 0) {
        return new Response(
          JSON.stringify({ error: "No eligible events found for this player" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Pick random event
      selectedEvent = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
    }

    // Create player_event record
    const { data: playerEvent, error: insertError } = await supabase
      .from("player_events")
      .insert({
        user_id: userId,
        event_id: selectedEvent.id,
        status: "pending_choice",
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    await supabase.from("admin_action_audit").insert({
      actor_user_id: user.id,
      action: "admin_trigger_event",
      target_table: "player_events",
      target_id: playerEvent.id,
      metadata: { userId, eventId: selectedEvent.id, category },
    });

    console.log(`[admin-trigger-event] Admin ${user.id} triggered event "${selectedEvent.title}" for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        playerEventId: playerEvent.id,
        event: {
          id: selectedEvent.id,
          title: selectedEvent.title,
          category: selectedEvent.category,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[admin-trigger-event] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
