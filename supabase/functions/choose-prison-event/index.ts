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
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { player_event_id, choice } = await req.json();

    if (!player_event_id || !choice || !["a", "b"].includes(choice)) {
      return new Response(
        JSON.stringify({ error: "Missing player_event_id or invalid choice (must be 'a' or 'b')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[choose-prison-event] User ${user.id} choosing ${choice} for event ${player_event_id}`);

    // Get the player event
    const { data: playerEvent, error: eventError } = await supabase
      .from("player_prison_events")
      .select("*, prison_events(*), player_imprisonments(*)")
      .eq("id", player_event_id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .single();

    if (eventError || !playerEvent) {
      return new Response(
        JSON.stringify({ error: "Event not found or already processed" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = playerEvent.prison_events;
    const imprisonment = playerEvent.player_imprisonments;
    const effects = choice === "a" ? event.option_a_effects : event.option_b_effects;

    // Apply effects
    let resultMessage = "";
    const appliedEffects: Record<string, number> = {};

    // Behavior score change
    if (effects.behavior_change) {
      const newBehavior = Math.max(0, Math.min(100, imprisonment.behavior_score + effects.behavior_change));
      await supabase
        .from("player_imprisonments")
        .update({ behavior_score: newBehavior })
        .eq("id", imprisonment.id);
      appliedEffects.behavior = effects.behavior_change;
    }

    // Sentence change
    if (effects.sentence_change) {
      const newSentence = Math.max(1, imprisonment.remaining_sentence_days + effects.sentence_change);
      const newReleaseDate = new Date();
      newReleaseDate.setDate(newReleaseDate.getDate() + newSentence);
      await supabase
        .from("player_imprisonments")
        .update({ 
          remaining_sentence_days: newSentence,
          release_date: newReleaseDate.toISOString()
        })
        .eq("id", imprisonment.id);
      appliedEffects.sentence = effects.sentence_change;
    }

    // Health change
    if (effects.health_change) {
      await supabase.rpc("update_player_health", {
        p_user_id: user.id,
        p_health_change: effects.health_change
      }).catch(() => {
        // If RPC doesn't exist, update directly
        return supabase
          .from("profiles")
          .update({ health: supabase.raw(`GREATEST(0, LEAST(100, health + ${effects.health_change}))`) })
          .eq("user_id", user.id);
      });
      appliedEffects.health = effects.health_change;
    }

    // XP gain
    if (effects.xp_gain) {
      appliedEffects.xp = effects.xp_gain;
    }

    // Skill bonus from cellmate interaction
    if (effects.cellmate_skill_bonus && imprisonment.cellmate_skill) {
      appliedEffects.skill_bonus = {
        skill: imprisonment.cellmate_skill,
        amount: effects.cellmate_skill_bonus
      };
    }

    // Handle escape attempt
    if (effects.escape_attempt) {
      const escapeSuccess = Math.random() < (effects.escape_success_chance || 0.1);
      
      await supabase
        .from("player_imprisonments")
        .update({ escape_attempts: imprisonment.escape_attempts + 1 })
        .eq("id", imprisonment.id);

      if (escapeSuccess) {
        // Successful escape
        await supabase
          .from("player_imprisonments")
          .update({ status: "escaped", released_at: new Date().toISOString() })
          .eq("id", imprisonment.id);

        await supabase
          .from("profiles")
          .update({ is_imprisoned: false, is_wanted: true })
          .eq("user_id", user.id);

        resultMessage = "🏃 You escaped! But you're now wanted by authorities. Avoid public activities or risk recapture.";
        appliedEffects.escaped = true;
      } else {
        // Failed escape - behavior penalty and sentence extension
        const newBehavior = Math.max(0, imprisonment.behavior_score - 20);
        const newSentence = imprisonment.remaining_sentence_days + 7;
        const newReleaseDate = new Date();
        newReleaseDate.setDate(newReleaseDate.getDate() + newSentence);

        await supabase
          .from("player_imprisonments")
          .update({ 
            behavior_score: newBehavior,
            remaining_sentence_days: newSentence,
            release_date: newReleaseDate.toISOString()
          })
          .eq("id", imprisonment.id);

        resultMessage = "🚨 Escape failed! You were caught. -20 behavior, +7 days sentence.";
        appliedEffects.escape_failed = true;
        appliedEffects.behavior = -20;
        appliedEffects.sentence = 7;
      }
    }

    // Mark event as completed
    await supabase
      .from("player_prison_events")
      .update({ 
        choice_made: choice,
        outcome_applied: true,
        status: "completed"
      })
      .eq("id", player_event_id);

    // Build result message if not already set
    if (!resultMessage) {
      const parts: string[] = [];
      if (appliedEffects.behavior) {
        parts.push(`Behavior ${appliedEffects.behavior > 0 ? "+" : ""}${appliedEffects.behavior}`);
      }
      if (appliedEffects.sentence) {
        parts.push(`Sentence ${appliedEffects.sentence > 0 ? "+" : ""}${appliedEffects.sentence} days`);
      }
      if (appliedEffects.health) {
        parts.push(`Health ${appliedEffects.health > 0 ? "+" : ""}${appliedEffects.health}`);
      }
      if (appliedEffects.xp) {
        parts.push(`+${appliedEffects.xp} XP`);
      }
      resultMessage = parts.length > 0 ? parts.join(", ") : "Choice made.";
    }

    // Log activity
    await supabase.from("activity_feed").insert({
      user_id: user.id,
      activity_type: "prison_event_choice",
      message: `Prison Event: ${event.title} - ${resultMessage}`,
      metadata: {
        event_id: event.id,
        choice,
        effects: appliedEffects
      }
    });

    console.log(`[choose-prison-event] Applied effects for user ${user.id}:`, appliedEffects);

    return new Response(
      JSON.stringify({
        success: true,
        message: resultMessage,
        effects: appliedEffects
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[choose-prison-event] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
