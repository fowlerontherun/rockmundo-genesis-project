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

    // Generate offers for all active bands with sufficient fame
    const { data: bands } = await supabaseClient
      .from('bands')
      .select('id, fame, genre')
      .gte('fame', 100)
      .limit(50);

    if (!bands || bands.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No eligible bands found' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let offersCreated = 0;

    for (const band of bands) {
      // Check if band already has pending offers
      const { count } = await supabaseClient
        .from('gig_offers')
        .select('id', { count: 'exact', head: true })
        .eq('band_id', band.id)
        .eq('status', 'pending');

      if (count && count >= 3) continue; // Max 3 pending offers per band

      // Generate 1-2 offers per band
      const numOffers = Math.floor(Math.random() * 2) + 1;
      
      // Get random promoters and venues
      const { data: promoters } = await supabaseClient
        .from('promoters')
        .select('*')
        .eq('active', true)
        .limit(5);

      const { data: venues } = await supabaseClient
        .from('venues')
        .select('*')
        .limit(10);

      if (!promoters || !venues) continue;

      for (let i = 0; i < numOffers; i++) {
        const promoter = promoters[Math.floor(Math.random() * promoters.length)];
        const venue = venues[Math.floor(Math.random() * venues.length)];

        const daysAhead = Math.floor(Math.random() * 14) + 3;
        const offeredDate = new Date();
        offeredDate.setDate(offeredDate.getDate() + daysAhead);

        const slotType = band.fame > 5000 ? 'headline' : band.fame > 2000 ? 'support' : 'opening';
        const basePayout = Math.floor(500 * (1 + band.fame / 10000) * (venue.economy_factor || 1));
        const ticketPrice = { opening: 15, support: 20, headline: 30 }[slotType] || 20;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 5);

        await supabaseClient.from('gig_offers').insert({
          band_id: band.id,
          venue_id: venue.id,
          promoter_id: promoter.id,
          offered_date: offeredDate.toISOString(),
          slot_type: slotType,
          base_payout: basePayout,
          ticket_price: ticketPrice,
          expires_at: expiresAt.toISOString(),
          offer_reason: `${promoter.name} has an opening at ${venue.name}`,
          metadata: { venue_name: venue.name, promoter_name: promoter.name },
        });

        offersCreated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, offers_created: offersCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
