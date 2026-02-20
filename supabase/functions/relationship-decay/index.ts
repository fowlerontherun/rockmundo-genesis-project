import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DECAY_RATES: Record<string, number> = {
  affection_score: -1,
  trust_score: -0.5,
  attraction_score: -0.3,
  loyalty_score: -0.5,
  jealousy_score: -1,
};

// Thresholds that trigger events when crossed during decay
const DECAY_THRESHOLDS = [
  { score: "trust_score", threshold: 20, direction: "down", event_key: "trust_low_decay" },
  { score: "loyalty_score", threshold: 20, direction: "down", event_key: "loyalty_fading" },
  { score: "affection_score", threshold: 0, direction: "down", event_key: "affection_gone_negative" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();

    // Fetch relationships that haven't been decayed in 24+ hours
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: relationships, error: fetchError } = await supabase
      .from("character_relationships")
      .select("*")
      .lt("last_decay_at", cutoff)
      .limit(500);

    if (fetchError) throw fetchError;

    if (!relationships?.length) {
      return new Response(
        JSON.stringify({ message: "No relationships need decay", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let eventsCreated = 0;

    for (const rel of relationships) {
      const lastInteraction = new Date(rel.last_interaction_at || rel.created_at);
      const daysSinceInteraction = Math.floor(
        (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
      );

      // No decay in first 3 days of inactivity (grace period)
      if (daysSinceInteraction < 3) continue;

      // Calculate decay (scales with inactivity duration)
      const decayMultiplier = Math.min(daysSinceInteraction / 7, 3); // Max 3x decay

      const oldScores = {
        affection_score: rel.affection_score,
        trust_score: rel.trust_score,
        attraction_score: rel.attraction_score,
        loyalty_score: rel.loyalty_score,
        jealousy_score: rel.jealousy_score,
      };

      // Affection decays toward 0 (not below/above)
      let newAffection = rel.affection_score;
      if (newAffection > 0) {
        newAffection = Math.max(0, newAffection + Math.floor(DECAY_RATES.affection_score * decayMultiplier));
      } else if (newAffection < 0) {
        newAffection = Math.min(0, newAffection - Math.floor(DECAY_RATES.affection_score * decayMultiplier));
      }

      const newScores = {
        affection_score: Math.max(-100, Math.min(100, newAffection)),
        trust_score: Math.max(0, Math.min(100, Math.floor(rel.trust_score + DECAY_RATES.trust_score * decayMultiplier))),
        attraction_score: Math.max(0, Math.min(100, Math.floor(rel.attraction_score + DECAY_RATES.attraction_score * decayMultiplier))),
        loyalty_score: Math.max(0, Math.min(100, Math.floor(rel.loyalty_score + DECAY_RATES.loyalty_score * decayMultiplier))),
        jealousy_score: Math.max(0, Math.min(100, Math.floor(rel.jealousy_score + DECAY_RATES.jealousy_score * decayMultiplier))),
      };

      // Update relationship
      await supabase
        .from("character_relationships")
        .update({ ...newScores, last_decay_at: now.toISOString() })
        .eq("id", rel.id);

      // Detect threshold events from decay
      const events: any[] = [];
      for (const def of DECAY_THRESHOLDS) {
        const oldVal = (oldScores as any)[def.score];
        const newVal = (newScores as any)[def.score];
        if (def.direction === "down" && oldVal > def.threshold && newVal <= def.threshold) {
          events.push({
            relationship_id: rel.id,
            event_type: "decay_warning",
            event_key: def.event_key,
            score_name: def.score,
            old_value: oldVal,
            new_value: newVal,
            threshold: def.threshold,
            message: `${def.score} decayed below ${def.threshold} due to inactivity`,
            processed: false,
          });
        }
      }

      if (events.length > 0) {
        await supabase.from("relationship_events").insert(events);
        eventsCreated += events.length;
      }

      processed++;
    }

    return new Response(
      JSON.stringify({
        message: "Decay processing complete",
        processed,
        eventsCreated,
        total: relationships.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Relationship decay error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
