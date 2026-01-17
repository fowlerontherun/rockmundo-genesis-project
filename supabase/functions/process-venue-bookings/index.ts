import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get completed gigs at company-owned venues that haven't been processed
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

    for (const gig of completedGigs || []) {
      const venue = gig.venues as any;
      if (!venue?.company_id) continue;

      // Check if already processed
      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->gig_id', gig.id)
        .single();

      if (existingTx) continue;

      // Calculate venue's cut (typically 15-30% of ticket revenue)
      const venueTicketCut = (gig.ticket_revenue || 0) * 0.20;
      const venueBarRevenue = gig.bar_sales || 0;
      const venueMerchCut = (gig.merchandise_sales || 0) * 0.10;
      
      const totalVenueRevenue = venueTicketCut + venueBarRevenue + venueMerchCut;

      if (totalVenueRevenue > 0) {
        // Credit company balance
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
            total_revenue: supabase.rpc ? newBalance : undefined,
            updated_at: now
          })
          .eq('id', venue.company_id);

        // Record transaction
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
              ticket_cut: venueTicketCut,
              bar_sales: venueBarRevenue,
              merch_cut: venueMerchCut
            }
          });

        processedCount++;
        totalRevenue += totalVenueRevenue;

        console.log(`[process-venue-bookings] Processed gig ${gig.id}: $${totalVenueRevenue.toFixed(2)}`);
      }
    }

    // Process venue bookings (private events, rehearsals, etc.)
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

      // Check if already processed
      const { data: existingTx } = await supabase
        .from('company_transactions')
        .select('id')
        .eq('metadata->booking_id', booking.id)
        .single();

      if (existingTx) continue;

      const bookingFee = booking.booking_fee || 0;
      
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
            metadata: { booking_id: booking.id }
          });

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
