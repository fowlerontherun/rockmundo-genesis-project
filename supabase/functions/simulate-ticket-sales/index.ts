import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calculate draw power - band's ability to fill venue
 */
function calculateDrawPower(bandFame: number, bandTotalFans: number, venueCapacity: number): number {
  const fameDrawBase = Math.min(1, bandFame / 5000);
  const fanDrawBase = Math.min(1, bandTotalFans / (venueCapacity * 3));
  const combinedDraw = (fameDrawBase * 0.6) + (fanDrawBase * 0.4);
  const venueSizeModifier = Math.max(0.3, 1 - (venueCapacity / 10000) * 0.5);
  return Math.min(1.2, combinedDraw * venueSizeModifier);
}

/**
 * Calculate daily ticket sales for a gig
 */
function calculateDailySales(
  bandFame: number,
  bandTotalFans: number,
  venueCapacity: number,
  ticketsSold: number,
  daysUntilGig: number,
  ticketPrice: number,
  daysBooked: number
): number {
  const remainingTickets = venueCapacity - ticketsSold;
  if (remainingTickets <= 0) return 0;

  const drawPower = calculateDrawPower(bandFame, bandTotalFans, venueCapacity);
  
  // Advance booking bonus
  const advanceBookingBonus = Math.min(0.3, (daysBooked / 14) * 0.3);
  
  // Price sensitivity
  const priceSensitivity = Math.max(0.5, 1 - (ticketPrice / 100) * 0.3);
  
  // Base daily rate based on draw power
  let baseDailyRate: number;
  if (drawPower >= 1.0) {
    baseDailyRate = 0.25 + (drawPower - 1) * 0.5;
  } else if (drawPower >= 0.7) {
    baseDailyRate = 0.12 + (drawPower - 0.7) * 0.4;
  } else if (drawPower >= 0.4) {
    baseDailyRate = 0.05 + (drawPower - 0.4) * 0.2;
  } else {
    baseDailyRate = 0.02 + drawPower * 0.08;
  }
  
  const dailySaleRate = baseDailyRate * priceSensitivity * (1 + advanceBookingBonus);
  
  // Calculate tickets to sell today
  let ticketsToday = Math.round(venueCapacity * dailySaleRate);
  
  // Urgency bonus as gig approaches
  const urgencyMultiplier = daysUntilGig <= 3 ? 1.5 : daysUntilGig <= 7 ? 1.2 : 1.0;
  ticketsToday = Math.round(ticketsToday * urgencyMultiplier);
  
  // Add randomness (±20%)
  const randomFactor = 0.8 + Math.random() * 0.4;
  ticketsToday = Math.round(ticketsToday * randomFactor);
  
  return Math.min(ticketsToday, remainingTickets);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log('Starting ticket sales simulation...');

    // Get all scheduled gigs
    const { data: gigs, error: gigsError } = await supabaseClient
      .from('gigs')
      .select(`
        id,
        band_id,
        venue_id,
        scheduled_date,
        tickets_sold,
        predicted_tickets,
        ticket_price,
        created_at,
        venues!gigs_venue_id_fkey (capacity)
      `)
      .eq('status', 'scheduled');

    if (gigsError) {
      console.error('Error fetching gigs:', gigsError);
      throw gigsError;
    }

    if (!gigs || gigs.length === 0) {
      console.log('No scheduled gigs found');
      return new Response(
        JSON.stringify({ success: true, message: 'No gigs to process', updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${gigs.length} scheduled gigs to process`);

    let updatedCount = 0;

    for (const gig of gigs) {
      try {
        // Get band info
        const { data: band } = await supabaseClient
          .from('bands')
          .select('fame, total_fans')
          .eq('id', gig.band_id)
          .single();

        if (!band) {
          console.warn(`Band not found for gig ${gig.id}`);
          continue;
        }

        const venueCapacity = (gig.venues as any)?.capacity || 100;
        const currentTicketsSold = gig.tickets_sold || 0;
        const scheduledDate = new Date(gig.scheduled_date);
        const createdAt = new Date(gig.created_at);
        const now = new Date();
        
        const daysUntilGig = Math.max(0, Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const daysBooked = Math.max(1, Math.ceil((scheduledDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));

        // Skip if already sold out
        if (currentTicketsSold >= venueCapacity) {
          console.log(`Gig ${gig.id} already sold out`);
          continue;
        }

        // Calculate daily sales
        const ticketsSoldToday = calculateDailySales(
          band.fame || 0,
          band.total_fans || 0,
          venueCapacity,
          currentTicketsSold,
          daysUntilGig,
          gig.ticket_price || 20,
          daysBooked
        );

        if (ticketsSoldToday > 0) {
          const newTotal = Math.min(currentTicketsSold + ticketsSoldToday, venueCapacity);
          
          const { error: updateError } = await supabaseClient
            .from('gigs')
            .update({
              tickets_sold: newTotal,
              last_ticket_update: now.toISOString()
            })
            .eq('id', gig.id);

          if (updateError) {
            console.error(`Error updating gig ${gig.id}:`, updateError);
          } else {
            console.log(`Gig ${gig.id}: sold ${ticketsSoldToday} tickets (${currentTicketsSold} -> ${newTotal})`);
            updatedCount++;
          }
        }
      } catch (gigError) {
        console.error(`Error processing gig ${gig.id}:`, gigError);
      }
    }

    console.log(`Ticket sales simulation completed. Updated ${updatedCount} gigs.`);

    return new Response(
      JSON.stringify({ success: true, message: 'Ticket sales updated', updated: updatedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in simulate-ticket-sales:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
