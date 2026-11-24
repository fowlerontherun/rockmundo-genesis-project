import { authorizeInternalJob } from "../_shared/trusted-scheduler.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const rejected = await authorizeInternalJob(req, supabase, "process-tour-travel", corsHeaders);
  if (rejected) return rejected;


  try {
    console.log('[process-tour-travel] Starting tour travel processing...')

    // Repair missed calendar mirrors first, including historical rows whose
    // original history INSERT succeeded but schedule INSERT failed (#4251).
    // The DB function is service-only and uses unique keys for concurrent runs.
    const { data: repairedCalendars, error: repairError } = await supabase.rpc(
      'reconcile_tour_travel_calendar', { p_batch_size: 100 },
    )
    if (repairError) throw repairError

    const now = new Date()
    const nowISO = now.toISOString()

    // STEP 1: Complete any in-progress tour travels that have arrived
    const { data: inProgressTravels, error: inProgressError } = await supabase
      .from('player_travel_history')
      .select('id, user_id, profile_id, to_city_id, arrival_time')
      .eq('status', 'in_progress')
      .not('tour_leg_id', 'is', null)
      .not('profile_id', 'is', null)
      .lte('arrival_time', nowISO)
    if (inProgressError) throw inProgressError

    let travelCompleted = 0
    if (!inProgressError && inProgressTravels) {
      console.log(`[process-tour-travel] Found ${inProgressTravels.length} in-progress tour travels to complete`)

      // === MORALE BOOST: Arriving at a new tour city is exciting (v1.0.969) ===
      // Collect unique band_ids from completed travels to boost morale once per band
      const completedTravelBandIds = new Set<string>();
      
      for (const travel of inProgressTravels) {
        try {
          // Keep history in_progress until the character and calendar are
          // updated; a failure before the final status write can be retried.
          const { error: scheduleError } = await supabase
            .from('player_scheduled_activities')
            .update({ status: 'completed' })
            .eq('profile_id', travel.profile_id)
            .eq('activity_type', 'travel')
            .in('status', ['scheduled', 'in_progress'])
            .contains('metadata', { travel_history_id: travel.id })
            .lte('scheduled_end', nowISO)
          if (scheduleError) throw scheduleError

          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              current_city_id: travel.to_city_id,
              is_traveling: false,
              travel_arrives_at: null,
            })
            .eq('id', travel.profile_id)
          if (profileError) throw profileError

          const { error: historyError } = await supabase
            .from('player_travel_history')
            .update({ status: 'completed' })
            .eq('id', travel.id)
            .eq('status', 'in_progress')
          if (historyError) throw historyError

          travelCompleted++
          console.log(`[process-tour-travel] Completed tour travel ${travel.id} for user ${travel.user_id}`)
          
          // Track band for morale boost
          try {
            const { data: bm } = await supabase.from('band_members').select('band_id').eq('profile_id', travel.profile_id).eq('is_touring_member', false).limit(1).maybeSingle();
            if (bm?.band_id) completedTravelBandIds.add(bm.band_id);
          } catch (_) {}
        } catch (err) {
          console.error(`[process-tour-travel] Error completing travel ${travel.id}:`, err)
        }
      }
      
      // Apply morale boost once per band for arriving at new tour city
      for (const bandId of completedTravelBandIds) {
        try {
          const { data: bd } = await supabase.from('bands').select('morale').eq('id', bandId).single();
          if (bd) {
            const newMorale = Math.min(100, ((bd as any).morale ?? 50) + 2);
            await supabase.from('bands').update({ morale: newMorale }).eq('id', bandId);
            console.log(`[process-tour-travel] Tour arrival → morale +2 for band ${bandId}`);
            // Health event log (v1.0.998)
            try { await supabase.from('band_health_events').insert({ band_id: bandId, event_type: 'morale', delta: 2, new_value: newMorale, source: 'tour_arrival', description: 'Arrived at new tour city' }); } catch (_) {}
          }
        } catch (e) { console.log('[process-tour-travel] Morale error:', e); }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        travelsCompleted: travelCompleted,
        calendarMirrorsRepaired: repairedCalendars ?? 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[process-tour-travel] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
