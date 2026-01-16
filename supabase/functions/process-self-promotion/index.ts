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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { activityId } = await req.json();

    if (!activityId) {
      return new Response(
        JSON.stringify({ error: "activityId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the activity
    const { data: activity, error: activityError } = await supabaseClient
      .from("self_promotion_activities")
      .select("*, bands:band_id(id, fame, total_fans)")
      .eq("id", activityId)
      .single();

    if (activityError || !activity) {
      return new Response(
        JSON.stringify({ error: "Activity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (activity.status === "completed") {
      return new Response(
        JSON.stringify({ error: "Activity already completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if activity should be completed (scheduled_end has passed)
    const now = new Date();
    const scheduledEnd = new Date(activity.scheduled_end);
    
    if (now < scheduledEnd) {
      return new Response(
        JSON.stringify({ error: "Activity not yet finished", finishesAt: activity.scheduled_end }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the catalog entry for this activity type
    const { data: catalogEntry, error: catalogError } = await supabaseClient
      .from("self_promotion_catalog")
      .select("*")
      .eq("activity_type", activity.activity_type)
      .single();

    if (catalogError || !catalogEntry) {
      return new Response(
        JSON.stringify({ error: "Activity type not found in catalog" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate rewards based on band fame (higher fame = slightly better results)
    const bandFame = activity.bands?.fame || 0;
    const fameMultiplier = 1 + Math.min(bandFame / 1000, 0.5); // Max 50% bonus
    
    const fameGained = Math.floor(
      (Math.random() * (catalogEntry.base_fame_max - catalogEntry.base_fame_min) + catalogEntry.base_fame_min) * fameMultiplier
    );
    
    const fansGained = Math.floor(
      (Math.random() * (catalogEntry.base_fan_max - catalogEntry.base_fan_min) + catalogEntry.base_fan_min) * fameMultiplier
    );

    // Update the activity with results
    const { error: updateActivityError } = await supabaseClient
      .from("self_promotion_activities")
      .update({
        status: "completed",
        fame_gained: fameGained,
        fans_gained: fansGained,
      })
      .eq("id", activityId);

    if (updateActivityError) {
      console.error("Failed to update activity:", updateActivityError);
      return new Response(
        JSON.stringify({ error: "Failed to update activity" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update band's fame and fans
    const newFame = (activity.bands?.fame || 0) + fameGained;
    const newFans = (activity.bands?.total_fans || 0) + fansGained;

    const { error: updateBandError } = await supabaseClient
      .from("bands")
      .update({
        fame: newFame,
        total_fans: newFans,
      })
      .eq("id", activity.band_id);

    if (updateBandError) {
      console.error("Failed to update band:", updateBandError);
    }

    // Record fame event
    await supabaseClient.from("band_fame_events").insert({
      band_id: activity.band_id,
      event_type: "self_promotion",
      fame_gained: fameGained,
      event_data: {
        activity_type: activity.activity_type,
        activity_name: catalogEntry.name,
        fans_gained: fansGained,
      },
    });

    // Set cooldown for this activity type
    const cooldownExpires = new Date();
    cooldownExpires.setDate(cooldownExpires.getDate() + catalogEntry.cooldown_days);

    await supabaseClient
      .from("self_promotion_cooldowns")
      .upsert({
        band_id: activity.band_id,
        activity_type: activity.activity_type,
        cooldown_expires_at: cooldownExpires.toISOString(),
      }, { onConflict: "band_id,activity_type" });

    return new Response(
      JSON.stringify({
        success: true,
        activityId,
        fameGained,
        fansGained,
        newTotalFame: newFame,
        newTotalFans: newFans,
        cooldownExpiresAt: cooldownExpires.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing self-promotion:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
