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

  try {
    console.log('[process-tour-travel] Starting tour travel processing...')

    const now = new Date().toISOString()

    // Find tour travel legs where departure date has passed and tour is active
    const { data: dueLegs, error: legsError } = await supabase
      .from('tour_travel_legs')
      .select(`
        id,
        tour_id,
        from_city_id,
        to_city_id,
        travel_mode,
        travel_cost,
        departure_date,
        arrival_date,
        tours!inner(
          id,
          band_id,
          status,
          bands!inner(id, name)
        )
      `)
      .lte('departure_date', now)
      .in('tours.status', ['active', 'scheduled', 'booked'])

    if (legsError) {
      console.error('[process-tour-travel] Error fetching tour legs:', legsError)
      throw legsError
    }

    console.log(`[process-tour-travel] Found ${dueLegs?.length || 0} due tour travel legs`)

    let processedCount = 0
    let travelCreated = 0

    for (const leg of dueLegs || []) {
      try {
        const tour = (leg as any).tours
        if (!tour?.band_id) {
          console.log(`[process-tour-travel] Skipping leg ${leg.id} - no band_id`)
          continue
        }

        // Get band members who travel with band
        const { data: members, error: membersError } = await supabase
          .from('band_members')
          .select('user_id')
          .eq('band_id', tour.band_id)
          .eq('member_status', 'active')
          .eq('travels_with_band', true)
          .not('user_id', 'is', null)

        if (membersError) {
          console.error(`[process-tour-travel] Error fetching members for band ${tour.band_id}:`, membersError)
          continue
        }

        console.log(`[process-tour-travel] Processing leg ${leg.id} for ${members?.length || 0} members`)

        for (const member of members || []) {
          if (!member.user_id) continue

          // Check if travel already exists for this user and leg
          const { data: existingTravel } = await supabase
            .from('player_travel_history')
            .select('id')
            .eq('user_id', member.user_id)
            .eq('from_city_id', leg.from_city_id)
            .eq('to_city_id', leg.to_city_id)
            .gte('departure_time', new Date(new Date(leg.departure_date).getTime() - 3600000).toISOString())
            .lte('departure_time', new Date(new Date(leg.departure_date).getTime() + 3600000).toISOString())
            .maybeSingle()

          if (existingTravel) {
            console.log(`[process-tour-travel] Travel already exists for user ${member.user_id}, leg ${leg.id}`)
            continue
          }

          // Determine travel status based on current time vs arrival time
          const arrivalTime = new Date(leg.arrival_date)
          const status = arrivalTime <= new Date() ? 'completed' : 'in_progress'

          // Create player travel history entry
          const { error: travelError } = await supabase
            .from('player_travel_history')
            .insert({
              user_id: member.user_id,
              from_city_id: leg.from_city_id,
              to_city_id: leg.to_city_id,
              transport_type: leg.travel_mode,
              travel_cost: 0, // Tour already paid for travel
              departure_time: leg.departure_date,
              arrival_time: leg.arrival_date,
              status: status,
              tour_leg_id: leg.id,
            })

          if (travelError) {
            console.error(`[process-tour-travel] Error creating travel for user ${member.user_id}:`, travelError)
            continue
          }

          // Update player profile
          if (status === 'completed') {
            await supabase
              .from('profiles')
              .update({
                current_city_id: leg.to_city_id,
                is_traveling: false,
                travel_arrives_at: null,
              })
              .eq('user_id', member.user_id)
          } else {
            await supabase
              .from('profiles')
              .update({
                is_traveling: true,
                travel_arrives_at: leg.arrival_date,
              })
              .eq('user_id', member.user_id)
          }

          travelCreated++
          console.log(`[process-tour-travel] Created ${status} travel for user ${member.user_id} to city ${leg.to_city_id}`)
        }

        processedCount++
      } catch (err) {
        console.error(`[process-tour-travel] Error processing leg ${leg.id}:`, err)
      }
    }

    console.log(`[process-tour-travel] Complete: ${processedCount} legs, ${travelCreated} travels created`)

    return new Response(
      JSON.stringify({
        success: true,
        processedLegs: processedCount,
        travelsCreated: travelCreated,
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
