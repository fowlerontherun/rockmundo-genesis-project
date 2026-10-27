-- City Scene read-only provenance verification. Isolated Postgres fixture only.
-- Creates three genuine-looking completed music sources, then simulates
-- an explicit source correction. Changes are rolled back in full.
begin;
do $$
declare
  v_city uuid:='20000000-0000-0000-0000-000000000001';
  v_profile uuid:='30000000-0000-0000-0000-000000000001';
  v_user uuid:='10000000-0000-0000-0000-000000000001';
  v_band uuid:=gen_random_uuid();
  v_venue uuid:=gen_random_uuid();
  v_gig uuid:=gen_random_uuid();
  v_outcome uuid:=gen_random_uuid();
  v_recording uuid:=gen_random_uuid();
  v_room uuid:=gen_random_uuid();
  v_rehearsal uuid:=gen_random_uuid();
  v_cycle uuid;
  v_template uuid;
  v_objective uuid;
  v_at timestamptz:=now()-interval '1 hour';
  v_result jsonb;
begin
  if (select count(*) from public.cities)<>1
     or exists(select 1 from public.scene_contributions)
  then raise exception 'ISOLATED_PROVENANCE_FIXTURE_REQUIRED';end if;

  select id into strict v_template
  from public.scene_challenge_templates where cadence='daily'
  order by id limit 1;
  insert into public.scene_challenge_cycles(
    city_id,cadence,starts_at,ends_at,
    active_population_snapshot,theme_slug,target_total,status
  ) values(v_city,'daily',now()-interval '2 hours',now()+interval '2 hours',
           1,'source-audit-fixture',3,'active')
  returning id into v_cycle;

  insert into public.scene_challenge_objectives(
    cycle_id,template_id,target_points,source_health_snapshot
  ) values(v_cycle,v_template,3,'{"scoring_enabled":false}'::jsonb)
  returning id into v_objective;

  insert into public.bands(id) values(v_band);
  insert into public.venues(id,city_id) values(v_venue,v_city);
  insert into public.gigs(id,venue_id,band_id,status)
  values(v_gig,v_venue,v_band,'completed');
  insert into public.gig_outcomes(id,gig_id,band_id,completed_at)
  values(v_outcome,v_gig,v_band,v_at);
  insert into public.gig_performers(
    gig_id,band_id,profile_id,lineup_status,performed_at
  ) values(v_gig,v_band,v_profile,'performed',v_at-interval '15 minutes');

  insert into public.recording_sessions(
    id,status,profile_id,user_id,city_id,band_id,
    scheduled_end,completed_at,xp_awards
  ) values(v_recording,'completed',v_profile,v_user,v_city,v_band,
    v_at-interval '10 minutes',v_at,'{"recording":8}'::jsonb);

  insert into public.rehearsal_rooms(id,city_id) values(v_room,v_city);
  insert into public.band_rehearsals(
    id,band_id,rehearsal_room_id,payment_profile_id,
    scheduled_end,completed_at,status,xp_earned
  ) values(v_rehearsal,v_band,v_room,v_profile,
    v_at-interval '10 minutes',v_at,'completed',100);

  insert into public.scene_contributions(
    objective_id,account_id,profile_id,band_id,city_id,
    source_type,source_event_id,source_completed_at,points
  ) values
    (v_objective,v_user,v_profile,v_band,v_city,
     'verified_gig_performance',v_outcome::text,v_at,1),
    (v_objective,v_user,v_profile,v_band,v_city,
     'completed_recording',v_recording::text,v_at,1),
    (v_objective,v_user,v_profile,v_band,v_city,
     'verified_rehearsal',v_rehearsal::text,v_at,1);

  v_result:=private.scene_source_integrity_preview(100);
  if (v_result->>'checked')::int<>3 or
     (v_result->>'suspected')::int<>0
  then raise exception 'VALID_COMPLETIONS_FALSE_POSITIVE: %',v_result;end if;

  -- Explicit changes in the source systems must be detected but not
  -- automatically delete earned player history.
  update public.gigs set cancelled_at=now() where id=v_gig;
  update public.recording_sessions set xp_awards='{}'::jsonb
    where id=v_recording;
  update public.band_rehearsals set xp_earned=0 where id=v_rehearsal;

  v_result:=private.scene_source_integrity_preview(100);
  if (v_result->>'checked')::int<>3
     or (v_result->>'suspected')::int<>3
     or jsonb_array_length(v_result->'sample')<>3
  then raise exception 'CORRECTED_SOURCE_NOT_FLAGGED: %',v_result;end if;

  if (select count(*) from public.scene_contributions
      where invalidated_at is not null)<>0
  then raise exception 'READ_ONLY_PREVIEW_MUTATED_PLAYER_POINTS';end if;

  update public.gigs set cancelled_at=null where id=v_gig;
  update public.recording_sessions
    set xp_awards='{"recording":8}'::jsonb where id=v_recording;
  update public.band_rehearsals
    set xp_earned=100 where id=v_rehearsal;
  v_result:=private.scene_source_integrity_preview(100);
  if (v_result->>'suspected')::int<>0
  then raise exception 'RESTORED_SOURCES_REMAIN_FLAGGED: %',v_result;end if;

  raise notice 'City Scene 3-source integrity, correction, and read-only verification passed';
end;
$$;
rollback;
