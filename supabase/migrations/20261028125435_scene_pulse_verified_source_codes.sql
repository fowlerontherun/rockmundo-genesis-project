-- Repair Scene Pulse mapping to actual immutable ledger source codes.
-- Output remains presentation-only categories, date-only aggregation, no IDs.
-- Preserves three-unique-account threshold, authorization and payout gates.
-- City Scene Pulse: read-only, aggregate community updates.
-- Do not publish identity, band, exact event timestamps, source IDs or
-- individual contributions. Groups of fewer than three distinct accounts
-- are deliberately suppressed even though board-wide progress still counts.
-- Existing mural milestones are already community-public and can appear.
-- Never enables scoring, reward policies, cron jobs or payouts.
begin;

create or replace function public.get_city_scene_pulse(
  p_city_id uuid,
  p_cadence text default 'weekly',
  p_limit integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_cycle_id uuid;
  v_entries jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;
  if p_city_id is null or p_cadence is null
    or p_cadence not in ('daily', 'weekly', 'monthly')
    or p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'INVALID_SCENE_PULSE_QUERY' using errcode='22023';
  end if;

  select cycle.id into v_cycle_id
  from public.scene_challenge_cycles cycle
  where cycle.city_id=p_city_id
    and cycle.cadence=p_cadence
    and cycle.starts_at <= now() and cycle.ends_at > now()
    and cycle.status in ('active','completed')
  order by cycle.starts_at desc, cycle.id
  limit 1;

  if v_cycle_id is null then
    return jsonb_build_object('city_id',p_city_id,'cadence',p_cadence,'entries','[]'::jsonb);
  end if;

  with anonymous_activity as (
    select
      (sc.source_completed_at at time zone 'UTC')::date as occurred_on,
      case sc.source_type
        when 'verified_gig_performance' then 'gig:verified_performance'
        when 'completed_recording' then 'recording:completed'
        when 'verified_rehearsal' then 'rehearsal:completed'
        when 'completed_verified_jam' then 'jam:verified_collaboration'
      end as action_type,
      count(distinct (sc.source_type, sc.source_event_id, sc.account_id))::integer as actions,
      count(distinct sc.account_id)::integer as participants
    from public.scene_contributions sc
    join public.scene_challenge_objectives objective on objective.id=sc.objective_id
    join public.scene_challenge_cycles cycle on cycle.id=objective.cycle_id
    where cycle.id=v_cycle_id
      and sc.city_id=p_city_id
      and sc.invalidated_at is null
      and sc.source_completed_at >= cycle.starts_at
      and sc.source_completed_at < cycle.ends_at
      and sc.source_type in (
        'verified_gig_performance',
        'completed_recording',
        'verified_rehearsal',
        'completed_verified_jam'
      )
    group by 1,2
    having count(distinct sc.account_id) >= 3
  ), public_entries as (
    select a.occurred_on, 'activity'::text as kind,
      a.action_type, a.actions, null::integer as milestone_percent
    from anonymous_activity a
    union all
    select (milestone.reached_at at time zone 'UTC')::date as occurred_on,
      'milestone'::text as kind,
      null::text as action_type,
      null::integer as actions,
      milestone.percent_threshold::integer as milestone_percent
    from public.scene_milestones milestone
    where milestone.cycle_id=v_cycle_id
      and milestone.revoked_at is null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day_utc', ranked.occurred_on::text,
        'kind', ranked.kind,
        'action_type', ranked.action_type,
        'actions', ranked.actions,
        'milestone_percent', ranked.milestone_percent
      )
      order by ranked.occurred_on desc, ranked.kind desc,
        ranked.milestone_percent desc nulls last,
        ranked.action_type asc nulls last
    ),
    '[]'::jsonb
  ) into v_entries
  from (
    select *
    from public_entries
    order by occurred_on desc, kind desc,
      milestone_percent desc nulls last, action_type asc nulls last
    limit p_limit
  ) ranked;

  return jsonb_build_object('city_id',p_city_id,'cadence',p_cadence,'entries',v_entries);
end;
$$;

revoke all on function public.get_city_scene_pulse(uuid,text,integer)
  from public, anon;
grant execute on function public.get_city_scene_pulse(uuid,text,integer)
  to authenticated, service_role;
commit;
