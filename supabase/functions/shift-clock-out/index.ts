import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();

    // Find active work shifts that have ended
    const { data: activeShifts, error: shiftsError } = await supabaseClient
      .from('profile_activity_statuses')
      .select('*')
      .eq('activity_type', 'work_shift')
      .eq('status', 'active')
      .lt('ends_at', now);

    if (shiftsError) throw shiftsError;

    console.log(`Found ${activeShifts?.length || 0} shifts to clock out`);

    for (const activity of activeShifts || []) {
      const shiftId = activity.metadata?.shift_history_id;
      if (!shiftId) continue;

      // Get shift details
      const { data: shift, error: shiftFetchError } = await supabaseClient
        .from('shift_history')
        .select('*, player_employment(*)')
        .eq('id', shiftId)
        .single();

      if (shiftFetchError || !shift) {
        console.error('Error fetching shift:', shiftFetchError);
        continue;
      }

      // Update shift to completed
      const { error: updateShiftError } = await supabaseClient
        .from('shift_history')
        .update({
          clock_out_time: now,
          status: 'completed'
        })
        .eq('id', shiftId);

      if (updateShiftError) {
        console.error('Error updating shift:', updateShiftError);
        continue;
      }

      // Update player employment stats
      const { error: employmentError } = await supabaseClient
        .from('player_employment')
        .update({
          shifts_completed: (shift.player_employment.shifts_completed || 0) + 1,
          total_earnings: (shift.player_employment.total_earnings || 0) + shift.earnings,
          last_shift_at: now
        })
        .eq('id', shift.employment_id);

      if (employmentError) {
        console.error('Error updating employment:', employmentError);
      }

      // Update profile with earnings, health, and fame impacts
      const { error: profileError } = await supabaseClient.rpc('increment', {
        row_id: shift.profile_id,
        x: shift.earnings,
        health_change: shift.health_impact,
        fame_change: shift.fame_impact
      }).then(() => 
        supabaseClient
          .from('profiles')
          .update({
            cash: supabaseClient.rpc('cash', { amount: shift.earnings }),
            health: supabaseClient.rpc('health', { change: shift.health_impact }),
            fame: supabaseClient.rpc('fame', { change: shift.fame_impact })
          })
          .eq('id', shift.profile_id)
      );

      // Simpler approach - just fetch and update
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('cash, health, fame')
        .eq('id', shift.profile_id)
        .single();

      if (profile) {
        await supabaseClient
          .from('profiles')
          .update({
            cash: (profile.cash || 0) + shift.earnings,
            health: Math.max(0, Math.min(100, (profile.health || 100) + shift.health_impact)),
            fame: Math.max(0, (profile.fame || 0) + shift.fame_impact)
          })
          .eq('id', shift.profile_id);
      }

      // Log XP earned
      await supabaseClient
        .from('experience_ledger')
        .insert({
          user_id: activity.profile_id,
          profile_id: shift.profile_id,
          activity_type: 'work_shift',
          xp_amount: shift.xp_earned,
          metadata: { job_id: shift.job_id, shift_id: shiftId }
        });

      // Clear activity status
      await supabaseClient
        .from('profile_activity_statuses')
        .delete()
        .eq('id', activity.id);

      console.log(`Clocked out shift ${shiftId}, awarded ${shift.earnings} cash and ${shift.xp_earned} XP`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: activeShifts?.length || 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
