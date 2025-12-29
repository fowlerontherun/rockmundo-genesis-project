import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============ AUTHENTICATION CHECK ============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Invalid token:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ ADMIN ROLE CHECK ============
    const { data: role, error: roleError } = await supabase.rpc('get_user_role', { _user_id: user.id });
    
    if (roleError || role !== 'admin') {
      console.error('Admin access denied for user:', user.id, 'Role:', role);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin action authorized for user:', user.id);

    // ============ INPUT VALIDATION ============
    const { gigIds } = await req.json();

    if (!Array.isArray(gigIds) || gigIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'gigIds must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format for all IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of gigIds) {
      if (typeof id !== 'string' || !uuidRegex.test(id)) {
        return new Response(
          JSON.stringify({ error: `Invalid UUID format: ${id}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Limit batch size to prevent abuse
    if (gigIds.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Maximum 50 gigs can be processed at once' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============ EXECUTE ADMIN ACTION ============
    const results = [];

    for (const gigId of gigIds) {
      try {
        // Get gig details with band info
        const { data: gig, error: gigError } = await supabase
          .from('gigs')
          .select('id, setlist_id, band_id, status, venue_id, ticket_price, venues!gigs_venue_id_fkey(capacity, name)')
          .eq('id', gigId)
          .single();

        if (gigError || !gig) {
          results.push({ gigId, success: false, error: gigError?.message || 'Gig not found' });
          continue;
        }

        // Determine new status based on setlist existence
        let newStatus = 'completed';
        if (!gig.setlist_id) {
          newStatus = 'cancelled';
        }

        // If completing, ensure outcome exists and update band stats
        if (newStatus === 'completed') {
          // Check if outcome exists
          const { data: existingOutcome } = await supabase
            .from('gig_outcomes')
            .select('id')
            .eq('gig_id', gigId)
            .single();

          if (!existingOutcome) {
            // Create a basic outcome
            const venueCapacity = (gig.venues as any)?.capacity || 500;
            const actualAttendance = Math.floor(venueCapacity * (0.4 + Math.random() * 0.4));
            const ticketRevenue = actualAttendance * (gig.ticket_price || 20);

            await supabase
              .from('gig_outcomes')
              .insert({
                gig_id: gigId,
                actual_attendance: actualAttendance,
                attendance_percentage: (actualAttendance / venueCapacity) * 100,
                ticket_revenue: ticketRevenue,
                merch_revenue: 0,
                total_revenue: ticketRevenue,
                venue_cost: 0,
                crew_cost: 0,
                equipment_cost: 0,
                total_costs: 0,
                net_profit: ticketRevenue,
                overall_rating: 15 + Math.random() * 5,
                performance_grade: 'B',
                venue_name: (gig.venues as any)?.name || 'Unknown Venue',
                venue_capacity: venueCapacity,
                fame_gained: Math.floor(actualAttendance * 0.1),
                new_fans_gained: Math.floor(actualAttendance * 0.05),
                completed_at: new Date().toISOString()
              });
          }

          // Get band and update stats
          const { data: band } = await supabase
            .from('bands')
            .select('fame, total_fans, band_balance')
            .eq('id', gig.band_id)
            .single();

          if (band) {
            const fameGain = 50 + Math.floor(Math.random() * 50);
            const newFans = 10 + Math.floor(Math.random() * 40);
            
            await supabase
              .from('bands')
              .update({
                fame: (band.fame || 0) + fameGain,
                total_fans: (band.total_fans || 0) + newFans,
                performance_count: supabase.rpc('increment_performance_count', { band_id: gig.band_id })
              })
              .eq('id', gig.band_id);
          }
        }

        // Update the gig
        const { error: updateError } = await supabase
          .from('gigs')
          .update({ 
            status: newStatus,
            completed_at: newStatus === 'completed' ? new Date().toISOString() : null
          })
          .eq('id', gigId);

        if (updateError) {
          results.push({ gigId, success: false, error: updateError.message });
        } else {
          results.push({ gigId, success: true, newStatus });
        }
      } catch (error: any) {
        console.error('Error fixing gig:', gigId, error);
        results.push({ gigId, success: false, error: error.message });
      }
    }

    console.log('Fix stuck gigs completed by admin:', user.id, 'Results:', results.length);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
