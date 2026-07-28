create or replace function public.catch_up_to_tour(
  p_tour_id uuid,
  p_profile_id uuid,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile profiles%rowtype;
  v_target_city_id uuid;
  v_departure timestamptz := now();
  v_arrival timestamptz := now() + interval '2 hours';
  v_fee numeric := 1500;
  v_existing player_travel_history%rowtype;
  v_travel_id uuid;
begin
  if v_user_id is null then
    raise exception 'tour_catch_up_unauthenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tour-catch-up:' || p_profile_id::text, 0));

  select * into v_profile
  from profiles
  where id = p_profile_id and user_id = v_user_id
  for update;

  if not found then
    raise exception 'tour_catch_up_profile_forbidden';
  end if;

  select pth.* into v_existing
  from player_travel_history pth
  where pth.profile_id = p_profile_id
    and pth.metadata ->> 'request_id' = p_request_id::text
  limit 1;

  if found then
    return jsonb_build_object(
      'tour_id', p_tour_id,
      'profile_id', p_profile_id,
      'travel_id', v_existing.id,
      'fee', v_fee,
      'arrival_time', v_existing.arrival_time,
      'already_booked', true,
      'request_id', p_request_id
    );
  end if;

  select coalesce(
    (
      select ttl.from_city_id
      from tour_travel_legs ttl
      where ttl.tour_id = p_tour_id
        and ttl.departure_date >= now()
      order by ttl.departure_date
      limit 1
    ),
    (
      select v.city_id
      from gigs g
      join venues v on v.id = g.venue_id
      where g.tour_id = p_tour_id
        and g.scheduled_date >= now()
        and g.status in ('scheduled', 'in_progress')
      order by g.scheduled_date
      limit 1
    )
  ) into v_target_city_id;

  if v_target_city_id is null then
    raise exception 'tour_catch_up_no_upcoming_stop';
  end if;

  if v_profile.current_city_id = v_target_city_id then
    return jsonb_build_object(
      'tour_id', p_tour_id,
      'profile_id', p_profile_id,
      'fee', 0,
      'already_in_city', true,
      'already_booked', false,
      'request_id', p_request_id
    );
  end if;

  if coalesce(v_profile.cash, 0) < v_fee then
    raise exception 'tour_catch_up_insufficient_funds';
  end if;

  update profiles
  set cash = cash - v_fee,
      is_traveling = true,
      travel_arrives_at = v_arrival
  where id = p_profile_id;

  insert into player_travel_history (
    user_id,
    profile_id,
    from_city_id,
    to_city_id,
    transport_type,
    cost_paid,
    departure_time,
    scheduled_departure_time,
    arrival_time,
    travel_duration_hours,
    status,
    metadata
  ) values (
    v_user_id,
    p_profile_id,
    v_profile.current_city_id,
    v_target_city_id,
    'plane',
    v_fee,
    v_departure,
    v_departure,
    v_arrival,
    2,
    'in_progress',
    jsonb_build_object(
      'tour_id', p_tour_id,
      'request_id', p_request_id,
      'kind', 'tour_catch_up'
    )
  ) returning id into v_travel_id;

  return jsonb_build_object(
    'tour_id', p_tour_id,
    'profile_id', p_profile_id,
    'travel_id', v_travel_id,
    'fee', v_fee,
    'arrival_time', v_arrival,
    'already_in_city', false,
    'already_booked', false,
    'request_id', p_request_id
  );
end;
$$;

revoke all on function public.catch_up_to_tour(uuid, uuid, uuid) from public;
grant execute on function public.catch_up_to_tour(uuid, uuid, uuid) to authenticated;
