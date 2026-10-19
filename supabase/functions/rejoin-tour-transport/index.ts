import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { tour_leg_id: requestedLegId, tour_id: requestedTourId, profile_id: requestedProfileId } = body as {
      tour_leg_id?: string
      tour_id?: string
      profile_id?: string
    }

    if (!requestedProfileId) {
      return new Response(JSON.stringify({ error: 'profile_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Resolve the exact character requested by the authenticated account.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, current_city_id')
      .eq('id', requestedProfileId)
      .eq('user_id', userId)
      .is('died_at', null)
      .is('deleted_at', null)
      .maybeSingle()
    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'Character not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const profileId = profile.id

    // Resolve which leg to rejoin
    let leg: any = null
    if (requestedLegId) {
      const { data } = await supabase
        .from('tour_travel_legs')
        .select('id, tour_id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, travel_duration_hours, status, tours!inner(id, band_id, status)')
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
        .select('id, tour_id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, travel_duration_hours, status, tours!inner(id, band_id, status)')
        .in('tour_id', tourIds)
        .neq('status', 'cancelled')
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
          .select('id, tour_id, from_city_id, to_city_id, travel_mode, departure_date, arrival_date, travel_duration_hours, status, tours!inner(id, band_id, status)')
          .in('tour_id', tourIds)
          .neq('status', 'cancelled')
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
    if ((leg as any).status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'This tour leg was cancelled and cannot be rejoined' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
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

    if (requestedTourId && requestedTourId !== leg.tour_id) {
      return new Response(JSON.stringify({ error: 'Requested leg is not part of the selected tour' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ALL history/calendar/travel-state updates are serialized in one
    // service-role-only DB transaction, which rechecks the active character,
    // tour membership, true departure city, overlapping trips and leg timing.
    // In particular a future leg NEVER changes profiles.current_city_id.
    const { data: settlement, error: settlementError } = await supabase.rpc(
      'schedule_tour_rejoin_atomic',
      { p_user_id: userId, p_profile_id: profileId, p_tour_leg_id: leg.id },
    )
    if (settlementError) throw settlementError
    if (settlement?.success !== true) {
      const messages: Record<string, string> = {
        not_in_departure_city: 'Travel to the tour departure city using normal transport before rejoining.',
        another_journey_active: 'Finish your current journey before rejoining this tour leg.',
        leg_already_finished: 'This leg has already arrived. Choose an upcoming journey or catch up through normal travel.',
        travel_already_finalized: 'This tour journey is already completed or cancelled.',
        invalid_tour_leg: 'This tour leg is not available for rejoining.',
        tour_not_active: 'This tour is no longer active.',
        not_tour_band_member: 'You are not an active member of this tour’s band.',
        character_not_found: 'The selected character is no longer available.',
      }
      const reason = String(settlement?.reason ?? 'rejoin_not_allowed')
      return new Response(JSON.stringify({ error: messages[reason] ?? 'Tour rejoin is not currently permitted.', reason }),
        { status: ['not_tour_band_member', 'character_not_found'].includes(reason) ? 403 : 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const status = settlement.status as 'scheduled' | 'in_progress'
    return new Response(JSON.stringify({
      success: true,
      status,
      tour_leg_id: settlement.tour_leg_id,
      from_city: settlement.from_city,
      to_city: settlement.to_city,
      arrival_time: settlement.arrival_time,
      travel_history_id: settlement.travel_history_id,
      schedule_id: settlement.schedule_id,
      already_booked: settlement.already_booked,
      message: status === 'scheduled'
        ? `Tour transport scheduled. Be in ${settlement.from_city} by departure; your current location has not changed.`
        : `Rejoined tour transport — arriving in ${settlement.to_city}.`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('[rejoin-tour-transport] Error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
