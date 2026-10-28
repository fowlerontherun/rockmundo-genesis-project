-- CI-only real PostgreSQL integration: owner consent, private exclusion,
-- bilateral blocks, mutes, duplicate-account prevention and payout fail-closed.
begin;

do $$
begin
  if has_table_privilege('authenticated','public.scene_leaderboard_opt_ins','SELECT')
     or has_table_privilege('authenticated','public.scene_leaderboard_opt_ins','INSERT')
     or has_function_privilege('anon','public.get_city_scene_leaderboard(uuid,text,integer)','EXECUTE')
     or has_function_privilege('anon','public.set_my_scene_leaderboard_opt_in(uuid,boolean)','EXECUTE') then
    raise exception 'Scene leaderboard ACL exposed private state';
  end if;
end;
$$;

insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000011'),
 ('10000000-0000-0000-0000-000000000012'),
 ('10000000-0000-0000-0000-000000000013'),
 ('10000000-0000-0000-0000-000000000014');
insert into public.cities(id,name) values
 ('20000000-0000-0000-0000-000000000011','Scene Leaderboard Test City');
insert into public.profiles(id,user_id,current_city_id,username,is_active,last_login_at) values
 ('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','Public A',true,now()),
 ('30000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000011','Public B',true,now()),
 ('30000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000013','20000000-0000-0000-0000-000000000011','Private C',true,now()),
 ('30000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000014','20000000-0000-0000-0000-000000000011','Viewer D',true,now());
insert into public.profile_privacy_settings(profile_id,profile_visibility,activity_visibility) values
 ('30000000-0000-0000-0000-000000000011','public','public'),
 ('30000000-0000-0000-0000-000000000012','public','public'),
 ('30000000-0000-0000-0000-000000000013','public','friends');
insert into public.scene_challenge_templates(slug,cadence,title,action_type,enabled)
values ('weekly-leaderboard-integration','weekly','Scene Contributor Test',
  'gig:verified_performance',false);
insert into public.scene_challenge_cycles
  (id,city_id,cadence,starts_at,ends_at,target_total,status)
values (
 '40000000-0000-0000-0000-000000000011',
 '20000000-0000-0000-0000-000000000011',
 'weekly',
 date_trunc('week',now() at time zone 'UTC') at time zone 'UTC',
 (date_trunc('week',now() at time zone 'UTC') + interval '7 days') at time zone 'UTC',
 10,'active'
);
insert into public.scene_challenge_objectives(id,cycle_id,template_id,target_points)
select '50000000-0000-0000-0000-000000000011',
  '40000000-0000-0000-0000-000000000011', id,10
from public.scene_challenge_templates where slug='weekly-leaderboard-integration';

insert into public.scene_contributions
  (objective_id,account_id,profile_id,city_id,source_type,source_event_id,source_completed_at,points)
values
 ('50000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000011','30000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000011','gig:verified_performance','lead-a',now(),2),
 ('50000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000012','30000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000011','gig:verified_performance','lead-b',now(),1),
 ('50000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000013','30000000-0000-0000-0000-000000000013','20000000-0000-0000-0000-000000000011','gig:verified_performance','lead-c',now(),3);

do $$
declare
  v_leaders jsonb;
  v_rejected boolean := false;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
  if not public.set_my_scene_leaderboard_opt_in('20000000-0000-0000-0000-000000000011',true) then
    raise exception 'First public account consent failed';
  end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000012',true);
  if not public.set_my_scene_leaderboard_opt_in('20000000-0000-0000-0000-000000000011',true) then
    raise exception 'Second public account consent failed';
  end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000013',true);
  begin
    perform public.set_my_scene_leaderboard_opt_in('20000000-0000-0000-0000-000000000011',true);
  exception when insufficient_privilege then
    v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Private profile incorrectly entered leaderboard'; end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000014',true);
  v_leaders := public.get_city_scene_leaderboard('20000000-0000-0000-0000-000000000011','weekly',10);
  if jsonb_array_length(v_leaders->'entries') <> 2
     or v_leaders->'entries'->0->>'display_name' <> 'Public A'
     or (v_leaders->'entries'->1->>'points')::int <> 1
     or v_leaders::text like '%Private C%'
     or (v_leaders->>'my_opted_in')::boolean then
    raise exception 'Public opt-in ranking/filtered privacy incorrect: %',v_leaders;
  end if;

  insert into public.player_blocks(blocker_id,blocked_id)
  values('30000000-0000-0000-0000-000000000014','30000000-0000-0000-0000-000000000012');
  v_leaders := public.get_city_scene_leaderboard('20000000-0000-0000-0000-000000000011','weekly',10);
  if jsonb_array_length(v_leaders->'entries') <> 1 or
     (v_leaders->'entries'->0->>'rank')::int <> 1 then
    raise exception 'Blocked accounts should be hidden, with contiguous ranks: %',v_leaders;
  end if;

  insert into public.profile_mutes(viewer_profile_id,target_profile_id)
  values('30000000-0000-0000-0000-000000000014','30000000-0000-0000-0000-000000000011');
  v_leaders := public.get_city_scene_leaderboard('20000000-0000-0000-0000-000000000011','weekly',10);
  if jsonb_array_length(v_leaders->'entries') <> 0 then
    raise exception 'Muted accounts were not hidden';
  end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000011',true);
  if public.set_my_scene_leaderboard_opt_in('20000000-0000-0000-0000-000000000011',false) then
    raise exception 'Explicit withdrawal did not return false';
  end if;
  if (select enabled from public.scene_leaderboard_opt_ins
      where account_id='10000000-0000-0000-0000-000000000011') then
    raise exception 'Opt-out did not persist within transaction';
  end if;

  if exists(select 1 from public.scene_reward_grant_receipts)
    or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled) then
    raise exception 'Leaderboard test changed payout state';
  end if;
end;
$$;
rollback;
