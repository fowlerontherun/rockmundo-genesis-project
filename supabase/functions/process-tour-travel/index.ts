import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Haversine distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate travel duration based on mode and distance
function calculateTravelDuration(distanceKm: number, mode: string): number {
  const speeds: Record<string, number> = {
    bus: 56,
    train: 200,
    plane: 944,
    ship: 39,
    tour_bus: 70,
    private_jet: 944,
  };
  const buffers: Record<string, number> = {
    bus: 0.27,
    train: 0.45,
    plane: 2.7,
    ship: 0.9,
    tour_bus: 0.27,
    private_jet: 0.5,
  };
  const speed = speeds[mode] || speeds.bus;
  const buffer = buffers[mode] || 0.3;
  return Math.max(1, Math.round((distanceKm / speed + buffer) * 10) / 10);
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

    const now = new Date()
    const nowISO = now.toISOString()

    // STEP 1: Complete any in-progress tour travels that have arrived
    const { data: inProgressTravels, error: inProgressError } = await supabase
      .from('player_travel_history')
      .select('id, user_id, to_city_id, arrival_time')
      .eq('status', 'in_progress')
      .not('tour_leg_id', 'is', null)
      .lte('arrival_time', nowISO)

    let travelCompleted = 0
    if (!inProgressError && inProgressTravels) {
      console.log(`[process-tour-travel] Found ${inProgressTravels.length} in-progress tour travels to complete`)

      // === MORALE BOOST: Arriving at a new tour city is exciting (v1.0.969) ===
      // Collect unique band_ids from completed travels to boost morale once per band
      const completedTravelBandIds = new Set<string>();
      
      for (const travel of inProgressTravels) {
        try {
          await supabase
            .from('player_travel_history')
            .update({ status: 'completed' })
            .eq('id', travel.id)

          await supabase
            .from('profiles')
            .update({
              current_city_id: travel.to_city_id,
              is_traveling: false,
              travel_arrives_at: null,
            })
            .eq('user_id', travel.user_id)

          // Complete the scheduled activity too
          await supabase
            .from('player_scheduled_activities')
            .update({ status: 'completed' })
            .eq('user_id', travel.user_id)
            .eq('activity_type', 'travel')
            .eq('status', 'in_progress')
            .lte('scheduled_end', nowISO)

          travelCompleted++
          console.log(`[process-tour-travel] Completed tour travel ${travel.id} for user ${travel.user_id}`)
          
          // Track band for morale boost
          try {
            const { data: bm } = await supabase.from('band_members').select('band_id').eq('user_id', travel.user_id).eq('is_touring_member', false).limit(1).maybeSingle();
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
            await supabase.from('bands').update({ morale: Math.min(100, ((bd as any).morale ?? 50) + 2) }).eq('id', bandId);
            console.log(`[process-tour-travel] Tour arrival → morale +2 for band ${bandId}`);
          }
        } catch (e) { console.log('[process-tour-travel] Morale error:', e); }
      }
    }

    // STEP 2: Find tour travel legs where departure date has passed and tour is active
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
        travel_duration_hours,
        tours!inner(
          id,
          band_id,
          status,
          bands:bands!tours_band_id_fkey(id, name)
        )
      `)
      .lte('departure_date', nowISO)

    if (legsError) {
      console.error('[process-tour-travel] Error fetching tour legs:', legsError)
      throw legsError
    }

    // Filter to only active/scheduled/booked tours
    const activeDueLegs = (dueLegs || []).filter((leg: any) => {
      const tourStatus = leg.tours?.status
      return ['active', 'scheduled', 'booked'].includes(tourStatus)
    })

    console.log(`[process-tour-travel] Found ${activeDueLegs.length} due tour travel legs (from ${dueLegs?.length || 0} total)`)

    let processedCount = 0
    let travelCreated = 0

    for (const leg of activeDueLegs) {
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

        // Get city coordinates for duration calculation if not already set
        let durationHours = leg.travel_duration_hours
        let actualArrivalDate = leg.arrival_date

        if (!durationHours || durationHours <= 0) {
          // Fetch city coordinates to calculate real duration
          const [fromCityRes, toCityRes] = await Promise.all([
            supabase.from('cities').select('name, country, latitude, longitude').eq('id', leg.from_city_id).single(),
            supabase.from('cities').select('name, country, latitude, longitude').eq('id', leg.to_city_id).single(),
          ])

          const fromCity = fromCityRes.data
          const toCity = toCityRes.data

          if (fromCity?.latitude && fromCity?.longitude && toCity?.latitude && toCity?.longitude) {
            const distanceKm = calculateDistance(fromCity.latitude, fromCity.longitude, toCity.latitude, toCity.longitude)
            durationHours = calculateTravelDuration(distanceKm, leg.travel_mode || 'bus')
          } else {
            // Fallback: estimate based on mode
            durationHours = leg.travel_mode === 'plane' ? 4 : leg.travel_mode === 'train' ? 6 : 8
          }

          // Calculate actual arrival based on departure + duration
          const departureTime = new Date(leg.departure_date)
          actualArrivalDate = new Date(departureTime.getTime() + durationHours * 60 * 60 * 1000).toISOString()

          // Update the leg with calculated values
          await supabase
            .from('tour_travel_legs')
            .update({ 
              travel_duration_hours: Math.ceil(durationHours),
              arrival_date: actualArrivalDate,
            })
            .eq('id', leg.id)
        }

        const fromCityRes = await supabase.from('cities').select('name, country').eq('id', leg.from_city_id).single()
        const toCityRes = await supabase.from('cities').select('name, country').eq('id', leg.to_city_id).single()
        const fromCityName = fromCityRes.data ? `${fromCityRes.data.name}, ${fromCityRes.data.country}` : 'Unknown'
        const toCityName = toCityRes.data ? `${toCityRes.data.name}, ${toCityRes.data.country}` : 'Unknown'

        for (const member of members || []) {
          if (!member.user_id) continue

          // Check if travel already exists for this user and leg
          const { data: existingTravel } = await supabase
            .from('player_travel_history')
            .select('id, status')
            .eq('tour_leg_id', leg.id)
            .eq('user_id', member.user_id)
            .maybeSingle()

          if (existingTravel) {
            console.log(`[process-tour-travel] Travel already exists for user ${member.user_id}, leg ${leg.id} (status: ${existingTravel.status})`)
            continue
          }

          // Determine travel status based on current time vs arrival time
          const arrivalTime = new Date(actualArrivalDate)
          const status = arrivalTime <= now ? 'completed' : 'in_progress'

          // Get player's profile id for scheduled activities
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', member.user_id)
            .single()

          // Create player travel history entry
          const { data: travelRecord, error: travelError } = await supabase
            .from('player_travel_history')
            .insert({
              user_id: member.user_id,
              from_city_id: leg.from_city_id,
              to_city_id: leg.to_city_id,
              transport_type: leg.travel_mode || 'bus',
              cost_paid: 0,
              departure_time: leg.departure_date,
              arrival_time: actualArrivalDate,
              travel_duration_hours: Math.ceil(durationHours),
              status: status,
              tour_leg_id: leg.id,
            })
            .select('id')
            .single()

          if (travelError) {
            console.error(`[process-tour-travel] Error creating travel for user ${member.user_id}:`, travelError)
            continue
          }

          // Create player_scheduled_activities for activity blocking
          if (profileData?.id) {
            const { error: activityError } = await supabase
              .from('player_scheduled_activities')
              .insert({
                user_id: member.user_id,
                profile_id: profileData.id,
                activity_type: 'travel',
                status: status === 'completed' ? 'completed' : 'in_progress',
                scheduled_start: leg.departure_date,
                scheduled_end: actualArrivalDate,
                title: `Tour Travel: ${fromCityName} → ${toCityName}`,
                description: `${leg.travel_mode || 'bus'} journey (${Math.round(durationHours)}h) — Tour`,
                location: toCityName,
                metadata: {
                  travel_history_id: travelRecord?.id,
                  tour_leg_id: leg.id,
                  tour_id: leg.tour_id,
                  from_city_id: leg.from_city_id,
                  to_city_id: leg.to_city_id,
                  transport_type: leg.travel_mode,
                },
              })

            if (activityError) {
              console.warn(`[process-tour-travel] Failed to create scheduled activity for user ${member.user_id}:`, activityError)
            }
          }

          // Update player profile based on status
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
                travel_arrives_at: actualArrivalDate,
              })
              .eq('user_id', member.user_id)
          }

          travelCreated++
          console.log(`[process-tour-travel] Created ${status} travel for user ${member.user_id} to ${toCityName} (${Math.round(durationHours)}h)`)
        }

        processedCount++
      } catch (err) {
        console.error(`[process-tour-travel] Error processing leg ${leg.id}:`, err)
      }
    }

    console.log(`[process-tour-travel] Complete: ${processedCount} legs, ${travelCreated} new travels, ${travelCompleted} completed`)

    return new Response(
      JSON.stringify({
        success: true,
        processedLegs: processedCount,
        travelsCreated: travelCreated,
        travelsCompleted: travelCompleted,
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