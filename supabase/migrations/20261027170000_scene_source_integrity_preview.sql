-- Private, read-only monitoring of scene contribution provenance.
-- Flags POSSIBLE source corrections, not fraud. Does not invalidate credits,
-- change challenge progress, or grant rewards. Manual review required.
begin;
create or replace function private.scene_source_integrity_preview(
  p_limit integer default 100
) returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit<1 or p_limit>500 then
    raise exception 'Scene integrity preview limit must be 1 to 500';
  end if;
  with candidates as materialized (
    select sc.id,sc.source_type,sc.source_event_id,
      sc.profile_id,sc.account_id,sc.band_id,
      sc.city_id,sc.source_completed_at
    from public.scene_contributions sc
    where sc.invalidated_at is null
      and sc.source_completed_at>=now()-interval '7 days'
      and sc.source_type in (
        'verified_gig_performance','completed_recording','verified_rehearsal'
      )
    order by sc.created_at desc,sc.id
    limit p_limit
  ),
  assessed as materialized (
    select c.id,c.source_type,c.source_event_id,
      case c.source_type
        when 'verified_gig_performance' then not exists(
          select 1 from public.gig_outcomes o
          join public.gigs g on g.id=o.gig_id
          join public.venues v on v.id=g.venue_id
          join public.gig_performers gp
            on gp.gig_id=o.gig_id and gp.profile_id=c.profile_id
          join public.profiles p on p.id=c.profile_id
          where o.id=c.source_event_id::uuid
            and o.completed_at=c.source_completed_at
            and o.band_id=c.band_id and g.band_id=c.band_id
            and g.status='completed' and g.cancelled_at is null
            and v.city_id=c.city_id
            and gp.lineup_status='performed'
            and gp.band_id=c.band_id
            and gp.performed_at is not null
            and gp.performed_at<=o.completed_at
            and p.user_id=c.account_id
        )
        when 'completed_recording' then not exists(
          select 1 from public.recording_sessions s
          join public.profiles p on p.id=s.profile_id
          where s.id=c.source_event_id::uuid
            and s.status='completed'
            and s.completed_at=c.source_completed_at
            and s.city_id=c.city_id
            and s.profile_id=c.profile_id
            and s.user_id=c.account_id
            and s.band_id is not distinct from c.band_id
            and p.user_id=c.account_id
            and s.scheduled_end<=s.completed_at
            and jsonb_typeof(s.xp_awards)='object'
            and s.xp_awards<>'{}'::jsonb
        )
        when 'verified_rehearsal' then not exists(
          select 1 from public.band_rehearsals r
          join public.rehearsal_rooms rr on rr.id=r.rehearsal_room_id
          join public.profiles p on p.id=r.payment_profile_id
          where r.id=c.source_event_id::uuid
            and r.status='completed'
            and r.completed_at=c.source_completed_at
            and r.payment_profile_id=c.profile_id
            and p.user_id=c.account_id
            and r.band_id=c.band_id
            and rr.city_id=c.city_id
            and r.scheduled_end<=r.completed_at
            and r.xp_earned>0
        )
        else false
      end as suspect
    from candidates c
  )
  select jsonb_build_object(
    'checked',count(*),
    'suspected',count(*) filter(where suspect),
    'sample',coalesce((
      select jsonb_agg(jsonb_build_object(
        'contribution_id',s.id,'source_type',s.source_type,
        'source_event_id',s.source_event_id
      ))
      from (select id,source_type,source_event_id
            from assessed where suspect order by id limit 10) s
    ),'[]'::jsonb)
  ) into v_result
  from assessed;
  return v_result;
end;
$$;
revoke all on function private.scene_source_integrity_preview(integer)
 from public,anon,authenticated;
grant execute on function private.scene_source_integrity_preview(integer)
 to service_role;
commit;