import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Travel hazard rates by transport mode
const TRANSPORT_HAZARD_RATES: Record<string, number> = {
  bus: 0.04,
  train: 0.02,
  plane: 0.015,
  ship: 0.03,
  private_jet: 0.005,
};

const TRAVEL_CONDITIONS = [
  { name: "food_poisoning", type: "sickness", severity: 55 },
  { name: "sprained_ankle", type: "injury", severity: 45 },
  { name: "back_strain", type: "injury", severity: 50 },
  { name: "severe_jetlag", type: "sickness", severity: 35 },
  { name: "flu", type: "sickness", severity: 40 },
  { name: "stomach_bug", type: "sickness", severity: 30 },
  { name: "anxiety", type: "mental_health", severity: 45 },
  { name: "burnout", type: "mental_health", severity: 55 },
  { name: "depression", type: "mental_health", severity: 40 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[complete-travel] Starting travel completion check...");

    // Find all in-progress travels that have arrived
    const { data: completedTravels, error: fetchError } = await supabase
      .from("player_travel_history")
      .select(`
        id,
        user_id,
        to_city_id,
        from_city_id,
        arrival_time,
        transport_mode,
        distance_km,
        to_city:to_city_id(name),
        from_city:from_city_id(name)
      `)
      .eq("status", "in_progress")
      .lte("arrival_time", new Date().toISOString());

    if (fetchError) {
      console.error("[complete-travel] Error fetching travels:", fetchError);
      throw fetchError;
    }

    console.log(`[complete-travel] Found ${completedTravels?.length || 0} travels to complete`);

    const results = [];

    for (const travel of completedTravels || []) {
      try {
        // Update travel status to completed
        const { error: travelError } = await supabase
          .from("player_travel_history")
          .update({ status: "completed" })
          .eq("id", travel.id);

        if (travelError) {
          console.error(`[complete-travel] Error updating travel ${travel.id}:`, travelError);
          continue;
        }

        // Update player's current city and travel status
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            current_city_id: travel.to_city_id,
            is_traveling: false,
            travel_arrives_at: null,
          })
          .eq("user_id", travel.user_id);

        if (profileError) {
          console.error(`[complete-travel] Error updating profile for user ${travel.user_id}:`, profileError);
          continue;
        }

        // Log activity
        const toCityName = (travel.to_city as any)?.name || "destination";
        const fromCityName = (travel.from_city as any)?.name || "origin";

        await supabase.from("activity_feed").insert({
          user_id: travel.user_id,
          activity_type: "travel_complete",
          message: `Arrived in ${toCityName} from ${fromCityName}`,
          metadata: {
            to_city_id: travel.to_city_id,
            from_city_id: travel.from_city_id,
            travel_id: travel.id,
          },
        });

        // === TRAVEL HAZARD ROLL ===
        const transportMode = (travel as any).transport_mode || "plane";
        const distanceKm = (travel as any).distance_km || 1000;
        let hazardChance = TRANSPORT_HAZARD_RATES[transportMode] || 0.02;
        if (distanceKm > 5000) hazardChance += 0.02;
        else if (distanceKm > 2000) hazardChance += 0.01;

        const hazardRoll = Math.random();
        if (hazardRoll < hazardChance) {
          // Trigger a travel hazard condition
          const conditionDef = TRAVEL_CONDITIONS[Math.floor(Math.random() * TRAVEL_CONDITIONS.length)];
          const severityVariance = 0.8 + Math.random() * 0.4;
          const severity = Math.max(10, Math.min(100, Math.round(conditionDef.severity * severityVariance)));

          const { error: conditionError } = await supabase
            .from("player_conditions")
            .insert({
              user_id: travel.user_id,
              condition_type: conditionDef.type,
              condition_name: conditionDef.name,
              severity,
              status: "active",
              cause: "travel",
              effects: {},
            });

          if (!conditionError) {
            // Send inbox notification
            const conditionLabel = conditionDef.name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
            await supabase.from("player_inbox").insert({
              user_id: travel.user_id,
              category: "wellness",
              title: `Travel Incident: ${conditionLabel}`,
              message: `You developed ${conditionLabel} during your journey to ${toCityName}. Check the Wellness page for treatment options.`,
              metadata: { condition_name: conditionDef.name, condition_type: conditionDef.type, severity },
              action_type: "navigate",
              action_data: { route: "/wellness", tab: "conditions" },
            });

            console.log(`[complete-travel] Travel hazard triggered for user ${travel.user_id}: ${conditionDef.name} (severity ${severity})`);

            // === TRAVEL HAZARD → MORALE (v1.0.966) ===
            try {
              const { data: bm } = await supabase.from('band_members').select('band_id').eq('user_id', travel.user_id).eq('is_touring_member', false).limit(1).maybeSingle();
              if (bm?.band_id) {
                const { data: bd } = await supabase.from('bands').select('morale').eq('id', bm.band_id).single();
                if (bd) {
                  const moralePenalty = severity >= 50 ? -6 : severity >= 30 ? -3 : -1;
                  await supabase.from('bands').update({ morale: Math.max(0, ((bd as any).morale ?? 50) + moralePenalty) } as any).eq('id', bm.band_id);
                  console.log(`[complete-travel] Travel hazard morale penalty: severity ${severity} → morale ${moralePenalty}`);
                }
              }
            } catch (_e) { /* non-critical */ }
          }
        }

        results.push({
          travel_id: travel.id,
          user_id: travel.user_id,
          destination: toCityName,
          status: "completed",
        });

        console.log(`[complete-travel] Completed travel ${travel.id} for user ${travel.user_id} to ${toCityName}`);
      } catch (err) {
        console.error(`[complete-travel] Error processing travel ${travel.id}:`, err);
      }
    }

    // Also check for scheduled travels that should start
    const { data: scheduledTravels, error: scheduledError } = await supabase
      .from("player_travel_history")
      .select("id, user_id, departure_time, arrival_time, scheduled_departure_time")
      .eq("status", "scheduled")
      .lte("scheduled_departure_time", new Date().toISOString());

    if (!scheduledError && scheduledTravels) {
      for (const travel of scheduledTravels) {
        const { error } = await supabase
          .from("player_travel_history")
          .update({
            status: "in_progress",
            departure_time: travel.scheduled_departure_time,
          })
          .eq("id", travel.id);

        if (!error) {
          // Update profile to traveling
          await supabase
            .from("profiles")
            .update({
              is_traveling: true,
              travel_arrives_at: travel.arrival_time,
            })
            .eq("user_id", travel.user_id);

          console.log(`[complete-travel] Started scheduled travel ${travel.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        completed_count: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[complete-travel] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
