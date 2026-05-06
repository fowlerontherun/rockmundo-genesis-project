import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculateTravelDuration(distanceKm: number, mode: string): number {
  const speeds: Record<string, number> = { bus: 95, train: 320, plane: 1250, ship: 65, tour_bus: 115, private_jet: 1350 }
  const buffers: Record<string, number> = { bus: 0.1, train: 0.15, plane: 0.75, ship: 0.3, tour_bus: 0.1, private_jet: 0.25 }
  const speed = speeds[mode] || speeds.bus
  const buffer = buffers[mode] || 0.3
  return Math.max(1, Math.round((distanceKm / speed + buffer) * 10) / 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = userData.user.id

    const body = await req.json().catch(() => ({}))
    const { tour_leg_id: requestedLegId, tour_id: requestedTourId } = body as { tour_leg_id?: string; tour_id?: string }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Find the active profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, current_city_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('died_at', null)
      .maybeSingle()
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Active profile not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const profileId = profile.id

    // Resolve which leg to rejoin
    let leg: any = null
    if (requestedLegId) {
      const { data } = await supabase
        .from('tour_travel_legs')
        .select('id, tour_id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, travel_duration_hours, tours!inner(id, band_id, status)')
        .eq('id', requestedLegId)
        .maybeSingle()
      leg = data
    } else {
      // Auto-detect: pick the next/current upcoming leg in any active tour for the player's bands
      const { data: memberships } = await supabase
        .from('band_members')
        .select('band_id')
        .eq('profile_id', profileId)
        .eq('member_status', 'active')
      const bandIds = (memberships || []).map((m: any) => m.band_id)
      if (bandIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No active band membership' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      let tourQuery = supabase.from('tours').select('id, band_id, status').in('band_id', bandIds).in('status', ['active', 'scheduled', 'booked'])
      if (requestedTourId) tourQuery = tourQuery.eq('id', requestedTourId)
      const { data: tours } = await tourQuery
      const tourIds = (tours || []).map((t: any) => t.id)
      if (tourIds.length === 0) {
        return new Response(JSON.stringify({ error: 'No active tours found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const nowISO = new Date().toISOString()
      // Prefer a leg currently in transit, else the next upcoming
      const { data: inTransit } = await supabase
        .from('tour_travel_legs')
        .select('id, tour_id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, travel_duration_hours, tours!inner(id, band_id, status)')
        .in('tour_id', tourIds)
        .lte('departure_date', nowISO)
        .gte('arrival_date', nowISO)
        .order('departure_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (inTransit) {
        leg = inTransit
      } else {
        const { data: upcoming } = await supabase
          .from('tour_travel_legs')
          .select('id, tour_id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, travel_duration_hours, tours!inner(id, band_id, status)')
          .in('tour_id', tourIds)
          .gte('departure_date', nowISO)
          .order('departure_date', { ascending: true })
          .limit(1)
          .maybeSingle()
        leg = upcoming
      }
    }

    if (!leg) {
      return new Response(JSON.stringify({ error: 'No tour travel leg found to rejoin' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const tour = (leg as any).tours
    if (!tour || !['active', 'scheduled', 'booked'].includes(tour.status)) {
      return new Response(JSON.stringify({ error: 'Tour is not active' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify the user is a member of the tour's band
    const { data: membership } = await supabase
      .from('band_members')
      .select('id, profile_id, user_id, member_status')
      .eq('band_id', tour.band_id)
      .eq('profile_id', profileId)
      .eq('member_status', 'active')
      .maybeSingle()
    if (!membership) {
      return new Response(JSON.stringify({ error: 'You are not an active member of this tour\'s band' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Recalc duration/arrival if missing
    let durationHours = leg.travel_duration_hours
    let arrivalDate = leg.arrival_date
    if (!durationHours || durationHours <= 0 || !arrivalDate) {
      const [fromRes, toRes] = await Promise.all([
        supabase.from('cities').select('latitude, longitude').eq('id', leg.from_city_id).maybeSingle(),
        supabase.from('cities').select('latitude, longitude').eq('id', leg.to_city_id).maybeSingle(),
      ])
      if (fromRes.data?.latitude && toRes.data?.latitude) {
        const dist = calculateDistance(fromRes.data.latitude, fromRes.data.longitude, toRes.data.latitude, toRes.data.longitude)
        durationHours = calculateTravelDuration(dist, leg.travel_mode || 'tour_bus')
      } else {
        durationHours = 4
      }
      arrivalDate = new Date(new Date(leg.departure_date).getTime() + durationHours * 3600 * 1000).toISOString()
    }

    const now = new Date()
    const nowISO = now.toISOString()
    const arrivalTime = new Date(arrivalDate)
    const departureTime = new Date(leg.departure_date)
    const status = arrivalTime <= now ? 'completed' : 'in_progress'

    // City names for messaging
    const [fromCityRes, toCityRes] = await Promise.all([
      supabase.from('cities').select('name, country').eq('id', leg.from_city_id).maybeSingle(),
      supabase.from('cities').select('name, country').eq('id', leg.to_city_id).maybeSingle(),
    ])
    const fromCityName = fromCityRes.data ? `${fromCityRes.data.name}, ${fromCityRes.data.country}` : 'Unknown'
    const toCityName = toCityRes.data ? `${toCityRes.data.name}, ${toCityRes.data.country}` : 'Unknown'

    // Upsert player_travel_history for this leg
    const { data: existing } = await supabase
      .from('player_travel_history')
      .select('id, status')
      .eq('tour_leg_id', leg.id)
      .eq('profile_id', profileId)
      .maybeSingle()

    let travelHistoryId: string | null = existing?.id ?? null
    if (existing) {
      await supabase
        .from('player_travel_history')
        .update({
          user_id: userId,
          from_city_id: leg.from_city_id,
          to_city_id: leg.to_city_id,
          transport_type: leg.travel_mode || 'tour_bus',
          departure_time: leg.departure_date,
          arrival_time: arrivalDate,
          travel_duration_hours: Math.ceil(durationHours),
          status,
        })
        .eq('id', existing.id)
    } else {
      const { data: created, error: insErr } = await supabase
        .from('player_travel_history')
        .insert({
          user_id: userId,
          profile_id: profileId,
          from_city_id: leg.from_city_id,
          to_city_id: leg.to_city_id,
          transport_type: leg.travel_mode || 'tour_bus',
          cost_paid: 0,
          departure_time: leg.departure_date,
          arrival_time: arrivalDate,
          travel_duration_hours: Math.ceil(durationHours),
          status,
          tour_leg_id: leg.id,
        })
        .select('id')
        .single()
      if (insErr) throw insErr
      travelHistoryId = created?.id ?? null
    }

    // Upsert scheduled activity
    const { data: existingActivity } = await supabase
      .from('player_scheduled_activities')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_type', 'travel')
      .contains('metadata', { tour_leg_id: leg.id })
      .maybeSingle()

    const activityPayload = {
      user_id: userId,
      profile_id: profileId,
      activity_type: 'travel',
      status: status === 'completed' ? 'completed' : 'in_progress',
      scheduled_start: leg.departure_date,
      scheduled_end: arrivalDate,
      title: `Tour Travel: ${fromCityName} → ${toCityName}`,
      description: `${leg.travel_mode || 'tour_bus'} journey (${Math.round(durationHours)}h) — Rejoined`,
      location: toCityName,
      metadata: {
        travel_history_id: travelHistoryId,
        tour_leg_id: leg.id,
        tour_id: leg.tour_id,
        from_city_id: leg.from_city_id,
        to_city_id: leg.to_city_id,
        transport_type: leg.travel_mode,
        rejoined: true,
      },
    }

    if (existingActivity) {
      await supabase.from('player_scheduled_activities').update(activityPayload).eq('id', existingActivity.id)
    } else {
      await supabase.from('player_scheduled_activities').insert(activityPayload)
    }

    // Sync profile location/travel state
    if (status === 'completed') {
      await supabase.from('profiles').update({
        current_city_id: leg.to_city_id,
        is_traveling: false,
        travel_arrives_at: null,
      }).eq('id', profileId)
    } else {
      await supabase.from('profiles').update({
        current_city_id: leg.from_city_id,
        is_traveling: true,
        travel_arrives_at: arrivalDate,
      }).eq('id', profileId)
    }

    return new Response(JSON.stringify({
      success: true,
      status,
      tour_leg_id: leg.id,
      from_city: fromCityName,
      to_city: toCityName,
      arrival_time: arrivalDate,
      message: status === 'completed'
        ? `Caught up with the tour in ${toCityName}.`
        : `Rejoined tour transport — arriving in ${toCityName}.`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[rejoin-tour-transport] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
