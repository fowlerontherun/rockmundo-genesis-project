-- Isolated CI: leader consent, verified band scoring, opt-out and visibility.
-- Rollback preserves real scores, XP policy state and all user records.
begin;

do $$
begin
  if has_table_privilege('authenticated','public.scene_band_leaderboard_opt_ins','SELECT')
    or has_table_privilege('authenticated','public.scene_band_leaderboard_opt_ins','INSERT')
    or has_function_privilege('anon','public.get_city_scene_band_supporters(uuid,text,integer)','EXECUTE')
    or has_function_privilege('anon','public.set_my_scene_band_leaderboard_opt_in(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'Band consent table/function is exposed';
  end if;
end;
$$;

insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000031'),
 ('10000000-0000-0000-0000-000000000032'),
 ('10000000-0000-0000-0000-000000000033');
insert into public.cities(id,name) values
 ('20000000-0000-0000-0000-000000000031','Band Supporters Test City');
insert into public.profiles(id,user_id,current_city_id,username,is_active,last_login_at) values
 ('30000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000031','Band Leader A',true,now()),
 ('30000000-0000-0000-0000-000000000032','10000000-0000-0000-0000-000000000032','20000000-0000-0000-0000-000000000031','Band Leader B',true,now()),
 ('30000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000033','20000000-0000-0000-0000-000000000031','Unrelated Viewer',true,now());
insert into public.bands(id,name,status,leader_id) values
 ('60000000-0000-0000-0000-000000000031','The Starlights','active','30000000-0000-0000-0000-000000000031'),
 ('60000000-0000-0000-0000-000000000032','The Quiet Ones','active','30000000-0000-0000-0000-000000000032');

insert into public.scene_challenge_templates(slug,cadence,title,action_type,enabled) values
 ('weekly-band-recognition-integration','weekly','Verified Band Recognition','gig:verified_performance',false);
insert into public.scene_challenge_cycles
  (id,city_id,cadence,starts_at,ends_at,target_total,status)
values
 ('40000000-0000-0000-0000-000000000031',
  '20000000-0000-0000-0000-000000000031','weekly',
  date_trunc('week',now() at time zone 'UTC') at time zone 'UTC',
  (date_trunc('week',now() at time zone 'UTC')+interval '7 days') at time zone 'UTC',
  10,'active');
insert into public.scene_challenge_objectives(id,cycle_id,template_id,target_points)
select '50000000-0000-0000-0000-000000000031',
 '40000000-0000-0000-0000-000000000031',id,10
from public.scene_challenge_templates where slug='weekly-band-recognition-integration';
insert into public.scene_contributions
 (objective_id,account_id,profile_id,band_id,city_id,source_type,source_event_id,source_completed_at,points)
values
 ('50000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000031','30000000-0000-0000-0000-000000000031','60000000-0000-0000-0000-000000000031','20000000-0000-0000-0000-000000000031','gig:verified_performance','band-31',now(),2),
 ('50000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000032','30000000-0000-0000-0000-000000000032','60000000-0000-0000-0000-000000000032','20000000-0000-0000-0000-000000000031','gig:verified_performance','band-32',now(),1);

do $$
declare
  v jsonb;
  v_denied boolean := false;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000033',true);
  v:=public.get_city_scene_band_supporters('20000000-0000-0000-0000-000000000031','weekly',10);
  if jsonb_array_length(v->'entries')<>0
    or jsonb_array_length(v->'my_bands')<>0 then
    raise exception 'Non-leader saw private band consent: %',v;
  end if;
  begin
    perform public.set_my_scene_band_leaderboard_opt_in(
      '20000000-0000-0000-0000-000000000031',
      '60000000-0000-0000-0000-000000000031',true);
  exception when insufficient_privilege then
    v_denied:=true;
  end;
  if not v_denied then
    raise exception 'Non-leader could opt in another band';
  end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000031',true);
  if not public.set_my_scene_band_leaderboard_opt_in(
    '20000000-0000-0000-0000-000000000031',
    '60000000-0000-0000-0000-000000000031',true) then
    raise exception 'Leader could not opt in verified band';
  end if;
  v:=public.get_city_scene_band_supporters('20000000-0000-0000-0000-000000000031','weekly',10);
  if jsonb_array_length(v->'entries')<>1
    or (v->'entries'->0->>'band_name')<>'The Starlights'
    or (v->'entries'->0->>'points')::int<>2
    or (v->'entries'->0->>'rank')::int<>1
    or (v->'entries'->0->>'verified_events')::int<>1
    or jsonb_array_length(v->'my_bands')<>1
    or (v->'my_bands'->0->>'enabled')::boolean is not true
    or v::text like '%The Quiet Ones%'
    or v::text like '%Band Leader B%' then
    raise exception 'Opt-in band result contains incorrect or private data: %',v;
  end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000032',true);
  if not public.set_my_scene_band_leaderboard_opt_in(
    '20000000-0000-0000-0000-000000000031',
    '60000000-0000-0000-0000-000000000032',true) then
    raise exception 'Second band consent failed';
  end if;
  v:=public.get_city_scene_band_supporters('20000000-0000-0000-0000-000000000031','weekly',10);
  if jsonb_array_length(v->'entries')<>2
    or (v->'entries'->1->>'band_name')<>'The Quiet Ones'
    or (v->'entries'->1->>'rank')::int<>2 then
    raise exception 'Sorted band ranking incorrect: %',v;
  end if;

  -- Leadership transfer immediately revokes prior leader control.
  update public.bands set leader_id='30000000-0000-0000-0000-000000000033'
  where id='60000000-0000-0000-0000-000000000031';
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000031',true);
  v_denied:=false;
  begin
    perform public.set_my_scene_band_leaderboard_opt_in(
      '20000000-0000-0000-0000-000000000031',
      '60000000-0000-0000-0000-000000000031',false);
  exception when insufficient_privilege then
    v_denied:=true;
  end;
  if not v_denied then raise exception 'Former leader still controls consent'; end if;

  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000033',true);
  if public.set_my_scene_band_leaderboard_opt_in(
    '20000000-0000-0000-0000-000000000031',
    '60000000-0000-0000-0000-000000000031',false) is not false then
    raise exception 'New leader could not withdraw band consent';
  end if;
  v:=public.get_city_scene_band_supporters('20000000-0000-0000-0000-000000000031','weekly',10);
  if jsonb_array_length(v->'entries')<>1 then
    raise exception 'Withdrawn band remained publicly ranked';
  end if;
  if exists(select 1 from public.scene_reward_grant_receipts)
     or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled) then
    raise exception 'Band recognition affected reward payouts';
  end if;
end;
$$;
rollback;
