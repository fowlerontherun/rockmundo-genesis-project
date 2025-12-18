import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
