import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RadioStation {
  id: string;
  name: string;
  country: string;
  listener_base: number;
  station_type: string;
  quality_level: number;
  accepted_genres: string[];
  min_fame_required: number;
}

interface Band {
  id: string;
  name: string;
  fame: number;
  genre: string;
  total_fans: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[generate-radio-invitations] Starting invitation generation...");

    // Get all active bands with some fame
    const { data: bands, error: bandsError } = await supabase
      .from("bands")
      .select("id, name, fame, genre, total_fans")
      .gt("fame", 100) // Minimum fame to receive invitations
      .eq("status", "active");

    if (bandsError) {
      console.error("[generate-radio-invitations] Error fetching bands:", bandsError);
      throw bandsError;
    }

    console.log(`[generate-radio-invitations] Found ${bands?.length || 0} eligible bands`);

    // Get all active radio stations
    const { data: stations, error: stationsError } = await supabase
      .from("radio_stations")
      .select("id, name, country, listener_base, station_type, quality_level, accepted_genres, min_fame_required")
      .eq("is_active", true);

    if (stationsError) {
      console.error("[generate-radio-invitations] Error fetching stations:", stationsError);
      throw stationsError;
    }

    console.log(`[generate-radio-invitations] Found ${stations?.length || 0} active stations`);

    // Get radio shows for scheduling
    const { data: shows, error: showsError } = await supabase
      .from("radio_shows")
      .select("id, station_id, show_name, host_name")
      .eq("is_active", true);

    if (showsError) {
      console.error("[generate-radio-invitations] Error fetching shows:", showsError);
      throw showsError;
    }

    const showsByStation = new Map<string, any[]>();
    for (const show of shows || []) {
      if (!showsByStation.has(show.station_id)) {
        showsByStation.set(show.station_id, []);
      }
      showsByStation.get(show.station_id)!.push(show);
    }

    let invitationsCreated = 0;
    const invitationsToCreate: any[] = [];

    for (const band of bands || []) {
      // Get band's country fame
      const { data: countryFame } = await supabase
        .from("band_country_fans")
        .select("country, fame, total_fans")
        .eq("band_id", band.id);

      const countryFameMap = new Map<string, number>();
      for (const cf of countryFame || []) {
        countryFameMap.set(cf.country, cf.fame || 0);
      }

      // Check existing pending invitations
      const { data: existingInvitations } = await supabase
        .from("radio_invitations")
        .select("station_id")
        .eq("band_id", band.id)
        .in("status", ["pending", "accepted"]);

      const existingStationIds = new Set((existingInvitations || []).map(i => i.station_id));

      // Find eligible stations for this band
      for (const station of stations || []) {
        // Skip if already has invitation
        if (existingStationIds.has(station.id)) continue;

        // Check country fame requirement
        const bandFameInCountry = countryFameMap.get(station.country) || 0;
        const requiredFame = station.min_fame_required || 0;

        // Band needs at least 50% of required fame OR 500+ global fame to be considered
        if (bandFameInCountry < requiredFame * 0.5 && band.fame < 500) continue;

        // Check genre match (stations invite artists in their genre)
        const genreMatch = station.accepted_genres?.some(
          (g: string) => g.toLowerCase() === band.genre?.toLowerCase()
        );
        if (!genreMatch && station.accepted_genres?.length > 0) continue;

        // Probability calculation based on fame and station quality
        // Higher fame = more likely, Higher quality station = less likely
        const fameRatio = Math.min(bandFameInCountry / Math.max(requiredFame, 100), 2);
        const qualityPenalty = station.quality_level / 10; // 0.1 to 1.0
        const baseProbability = 0.05; // 5% base chance per day
        const inviteProbability = baseProbability * fameRatio / qualityPenalty;

        // Random check
        if (Math.random() > inviteProbability) continue;

        // Determine invitation type based on fame level
        let invitationType: "interview" | "live_lounge" | "guest_dj";
        const roll = Math.random();
        if (band.fame >= 5000 && roll < 0.2) {
          invitationType = "guest_dj";
        } else if (band.fame >= 1000 && roll < 0.4) {
          invitationType = "live_lounge";
        } else {
          invitationType = "interview";
        }

        // Calculate rewards based on station size and invitation type
        const baseMultiplier = Math.log10(station.listener_base + 1) / 2;
        let fameReward: number;
        let fanReward: number;
        let xpReward: number;

        switch (invitationType) {
          case "guest_dj":
            fameReward = Math.floor(50 * baseMultiplier * station.quality_level);
            fanReward = Math.floor(200 * baseMultiplier);
            xpReward = 100;
            break;
          case "live_lounge":
            fameReward = Math.floor(30 * baseMultiplier * station.quality_level);
            fanReward = Math.floor(100 * baseMultiplier);
            xpReward = 75;
            break;
          default: // interview
            fameReward = Math.floor(15 * baseMultiplier * station.quality_level);
            fanReward = Math.floor(50 * baseMultiplier);
            xpReward = 50;
        }

        // Get a random show from this station
        const stationShows = showsByStation.get(station.id) || [];
        const selectedShow = stationShows[Math.floor(Math.random() * stationShows.length)];

        // Schedule for 1-7 days from now
        const scheduledAt = new Date();
        scheduledAt.setDate(scheduledAt.getDate() + Math.floor(Math.random() * 7) + 1);

        // Expires in 48 hours
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        invitationsToCreate.push({
          station_id: station.id,
          band_id: band.id,
          invitation_type: invitationType,
          status: "pending",
          scheduled_at: scheduledAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          fame_reward: fameReward,
          fan_reward: fanReward,
          xp_reward: xpReward,
          show_id: selectedShow?.id || null,
        });

        // Limit invitations per band per run
        if (invitationsToCreate.filter(i => i.band_id === band.id).length >= 3) break;
      }
    }

    // Batch insert invitations
    if (invitationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("radio_invitations")
        .insert(invitationsToCreate);

      if (insertError) {
        console.error("[generate-radio-invitations] Error inserting invitations:", insertError);
        throw insertError;
      }

      invitationsCreated = invitationsToCreate.length;
    }

    // Expire old pending invitations
    const { data: expired, error: expireError } = await supabase
      .from("radio_invitations")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (expireError) {
      console.error("[generate-radio-invitations] Error expiring invitations:", expireError);
    }

    console.log(`[generate-radio-invitations] Created ${invitationsCreated} invitations, expired ${expired?.length || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        invitations_created: invitationsCreated,
        invitations_expired: expired?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[generate-radio-invitations] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
