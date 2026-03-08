import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper: get company owner's band reputation
async function getCompanyOwnerReputation(supabase: any, companyId: string): Promise<{ bandId: string | null; repScore: number }> {
  try {
    const { data: company } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .single();
    if (!company?.owner_id) return { bandId: null, repScore: 0 };

    const { data: member } = await supabase
      .from('band_members')
      .select('band_id, bands(id, reputation_score, morale)')
      .eq('user_id', company.owner_id)
      .eq('role', 'leader')
      .limit(1)
      .single();
    if (member?.bands) {
      return { bandId: member.band_id, repScore: member.bands.reputation_score ?? 0 };
    }
  } catch (_e) { /* no band */ }
  return { bandId: null, repScore: 0 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[process-venue-bookings] Starting venue booking processing...');

  try {
    const now = new Date().toISOString();

    const { data: completedGigs, error: gigsError } = await supabase
      .from('gigs')
      .select(`
        id,
        venue_id,
        ticket_revenue,
        bar_sales,
        merchandise_sales,
        status,
        venues!inner(
          id,
          name,
          company_id,
          is_company_owned
        )
      `)
      .eq('status', 'completed')
      .eq('venues.is_company_owned', true)
      .not('venues.company_id', 'is', null);

    if (gigsError) {
      console.error('[process-venue-bookings] Error fetching gigs:', gigsError);
      throw gigsError;
    }

    console.log(`[process-venue-bookings] Found ${completedGigs?.length || 0} completed gigs at company venues`);

    let processedCount = 0;
    let totalRevenue = 0;

    // Cache reputation lookups per company
    const repCache: Record<string, { bandId: string | null; repScore: number }> = {};

    for (const gig of completedGigs || []) {
      const venue = gig.venues as any;
      if (!venue?.company_id) continue;

      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->gig_id', gig.id)
        .single();

      if (existingTx) continue;

      // Get reputation modifier for this venue's company owner
      if (!repCache[venue.company_id]) {
        repCache[venue.company_id] = await getCompanyOwnerReputation(supabase, venue.company_id);
      }
      const { bandId, repScore } = repCache[venue.company_id];
      // Revenue scaling: 0.9x (toxic) → 1.1x (iconic)
      const repMod = parseFloat((0.9 + ((repScore + 100) / 200) * 0.2).toFixed(3));

      const venueTicketCut = (gig.ticket_revenue || 0) * 0.20;
      const venueBarRevenue = gig.bar_sales || 0;
      const venueMerchCut = (gig.merchandise_sales || 0) * 0.10;
      
      const baseRevenue = venueTicketCut + venueBarRevenue + venueMerchCut;
      const totalVenueRevenue = Math.round(baseRevenue * repMod);

      if (totalVenueRevenue > 0) {
        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', venue.company_id)
          .single();

        const newBalance = (company?.balance || 0) + totalVenueRevenue;

        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: now
          })
          .eq('id', venue.company_id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: venue.company_id,
            transaction_type: 'income',
            amount: totalVenueRevenue,
            description: `Gig revenue from ${venue.name}`,
            category: 'venue_income',
            metadata: {
              gig_id: gig.id,
              venue_id: venue.id,
              ticket_cut: Math.round(venueTicketCut * repMod),
              bar_sales: Math.round(venueBarRevenue * repMod),
              merch_cut: Math.round(venueMerchCut * repMod),
              reputation_modifier: repMod
            }
          });

        processedCount++;
        totalRevenue += totalVenueRevenue;

        // Award +1 morale for successful venue revenue
        if (bandId) {
          const { data: band } = await supabase.from('bands').select('morale').eq('id', bandId).single();
          if (band) {
            const newMorale = Math.min(100, (band.morale ?? 50) + 1);
            await supabase.from('bands').update({ morale: newMorale }).eq('id', bandId);
            try {
              await supabase.from('band_health_events').insert({
                band_id: bandId, event_type: 'morale', delta: 1, new_value: newMorale, source: 'venue_booking', description: `Venue gig revenue: $${totalVenueRevenue}`,
              });
            } catch (_logErr) { /* non-critical */ }
          }
        }

        console.log(`[process-venue-bookings] Gig ${gig.id}: $${totalVenueRevenue} (repMod ${repMod})`);
      }
    }

    // Process venue bookings (private events)
    const { data: venueBookings } = await supabase
      .from('venue_bookings')
      .select(`
        id,
        venue_id,
        booking_fee,
        status,
        end_time,
        venues!inner(
          id,
          name,
          company_id,
          is_company_owned
        )
      `)
      .eq('status', 'completed')
      .eq('venues.is_company_owned', true)
      .not('venues.company_id', 'is', null);

    for (const booking of venueBookings || []) {
      const venue = booking.venues as any;
      if (!venue?.company_id) continue;

      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->booking_id', booking.id)
        .single();

      if (existingTx) continue;

      // Get reputation modifier
      if (!repCache[venue.company_id]) {
        repCache[venue.company_id] = await getCompanyOwnerReputation(supabase, venue.company_id);
      }
      const { bandId: bId, repScore: rScore } = repCache[venue.company_id];
      const bookingRepMod = parseFloat((0.9 + ((rScore + 100) / 200) * 0.2).toFixed(3));

      const baseBookingFee = booking.booking_fee || 0;
      const bookingFee = Math.round(baseBookingFee * bookingRepMod);
      
      if (bookingFee > 0) {
        const { data: company } = await supabase
          .from('companies')
          .select('balance')
          .eq('id', venue.company_id)
          .single();

        const newBalance = (company?.balance || 0) + bookingFee;

        await supabase
          .from('companies')
          .update({ 
            balance: newBalance,
            updated_at: now
          })
          .eq('id', venue.company_id);

        await supabase
          .from('company_transactions')
          .insert({
            company_id: venue.company_id,
            transaction_type: 'income',
            amount: bookingFee,
            description: `Venue booking at ${venue.name}`,
            category: 'venue_booking',
            metadata: { booking_id: booking.id, reputation_modifier: bookingRepMod }
          });

        // Award +1 morale for booking revenue
        if (bId) {
          const { data: band } = await supabase
            .from('bands')
            .select('morale')
            .eq('id', bId)
            .single();
          if (band) {
            const newMorale = Math.min(100, (band.morale ?? 50) + 1);
            await supabase.from('bands').update({ morale: newMorale }).eq('id', bId);
          }
        }

        processedCount++;
        totalRevenue += bookingFee;
      }
    }

    console.log(`[process-venue-bookings] Complete: ${processedCount} bookings, $${totalRevenue.toFixed(2)} revenue`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      totalRevenue
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[process-venue-bookings] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
