
create or replace function public.get_fame_fans_attribution(
  p_profile_id uuid,
  p_day date
)
returns table(
  occurred_at timestamptz,
  axis text,
  source_system text,
  event_type text,
  delta numeric,
  xp_delta integer,
  cash_delta integer,
  gig_grade text,
  entity_kind text,
  entity_id uuid,
  scope text,
  notes jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user_id uuid;
  v_start timestamptz := (p_day::timestamptz);
  v_end timestamptz := ((p_day + 1)::timestamptz);
  v_band_ids uuid[];
begin
  -- admin gate
  if not public.has_role(v_uid, 'admin') then
    raise exception 'admin role required';
  end if;

  select user_id into v_user_id from public.profiles where id = p_profile_id;
  if v_user_id is null then
    raise exception 'profile not found';
  end if;

  select coalesce(array_agg(distinct band_id), '{}')
    into v_band_ids
  from public.band_members
  where profile_id = p_profile_id;

  return query
  -- Fame: band_fame_events for any band the character is in
  select
    bfe.created_at as occurred_at,
    'fame'::text as axis,
    'band_fame_events'::text as source_system,
    bfe.event_type::text as event_type,
    bfe.fame_gained::numeric as delta,
    null::integer as xp_delta,
    null::integer as cash_delta,
    coalesce(bfe.event_data->>'grade', bfe.event_data->>'gig_grade')::text as gig_grade,
    'band'::text as entity_kind,
    bfe.band_id as entity_id,
    'band'::text as scope,
    bfe.event_data as notes
  from public.band_fame_events bfe
  where bfe.band_id = any(v_band_ids)
    and bfe.created_at >= v_start and bfe.created_at < v_end

  union all
  -- Fame history (city/country/global scopes)
  select
    bfh.recorded_at,
    'fame',
    'band_fame_history',
    bfh.event_type,
    bfh.fame_change::numeric,
    null, null, null,
    'band', bfh.band_id,
    coalesce(bfh.scope, 'global'),
    jsonb_build_object('city_id', bfh.city_id, 'country', bfh.country, 'fame_value', bfh.fame_value)
  from public.band_fame_history bfh
  where bfh.band_id = any(v_band_ids)
    and bfh.recorded_at >= v_start and bfh.recorded_at < v_end

  union all
  -- Reputation events (character-level)
  select
    re.created_at,
    'fame',
    'reputation_events',
    coalesce(re.event_type, 'reputation'),
    coalesce((re.metadata->>'fame_delta')::numeric, 0),
    null, null, null,
    'profile', p_profile_id,
    coalesce(re.metadata->>'scope', 'global'),
    to_jsonb(re)
  from public.reputation_events re
  where re.profile_id = p_profile_id
    and re.created_at >= v_start and re.created_at < v_end

  union all
  -- Fans: gig fan conversions (band-scoped)
  select
    gfc.created_at,
    'fans',
    'gig_fan_conversions',
    'gig_conversion',
    gfc.new_fans_gained::numeric,
    null, null,
    (select pgx.grade::text from public.player_gig_xp pgx where pgx.gig_id = gfc.gig_id limit 1),
    'gig', gfc.gig_id,
    'global',
    jsonb_build_object(
      'attendance', gfc.attendance_count,
      'repeat_fans', gfc.repeat_fans,
      'superfans', gfc.superfans_converted,
      'conversion_rate', gfc.conversion_rate,
      'demographics', gfc.fan_demographics
    )
  from public.gig_fan_conversions gfc
  where gfc.band_id = any(v_band_ids)
    and gfc.created_at >= v_start and gfc.created_at < v_end

  union all
  -- Fans: DikCok missions
  select
    dfm.created_at,
    'fans',
    'dikcok_missions',
    coalesce(dfm.status, 'mission'),
    coalesce((dfm.metadata->>'fans_gained')::numeric, 0),
    null, null, null,
    'mission', dfm.id,
    'global',
    to_jsonb(dfm)
  from public.dikcok_fan_missions dfm
  where dfm.profile_id = p_profile_id
    and dfm.created_at >= v_start and dfm.created_at < v_end

  union all
  -- XP ledger context (no direct fame/fans delta, but shown as 0-delta XP rows)
  select
    el.created_at,
    'xp',
    'experience_ledger',
    coalesce(el.activity_type, 'xp'),
    0::numeric,
    el.xp_amount,
    null,
    null,
    'profile', p_profile_id,
    coalesce(el.skill_slug, 'general'),
    el.metadata
  from public.experience_ledger el
  where el.profile_id = p_profile_id
    and el.created_at >= v_start and el.created_at < v_end

  order by occurred_at desc;
end;
$$;

grant execute on function public.get_fame_fans_attribution(uuid, date) to authenticated;
