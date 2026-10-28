-- CI-only City Scene legacy history verification.
-- All fixtures are rolled back. No XP entitlement or award is created.
begin;

do $$
begin
  if has_function_privilege('anon','public.get_city_scene_legacy(uuid,text,integer)','EXECUTE') then
    raise exception 'Anonymous users can read City Scene legacy';
  end if;
  if not has_function_privilege('authenticated','public.get_city_scene_legacy(uuid,text,integer)','EXECUTE') then
    raise exception 'Authenticated City Scene legacy RPC inaccessible';
  end if;
end;
$$;

insert into auth.users(id)
values ('10000000-0000-0000-0000-000000000071');
insert into public.cities(id,name)
values ('20000000-0000-0000-0000-000000000071','Legacy Test City'),
       ('20000000-0000-0000-0000-000000000072','Other Test City');
insert into public.profiles(id,user_id,current_city_id,is_active,last_login_at)
values ('30000000-0000-0000-0000-000000000071',
        '10000000-0000-0000-0000-000000000071',
        '20000000-0000-0000-0000-000000000071',true,now());

insert into public.scene_challenge_templates(slug,cadence,title,action_type,enabled)
values
('legacy-weekly-ci','weekly','Legacy Weekly Test','gig:verified_performance',false),
('legacy-daily-ci','daily','Legacy Daily Test','gig:verified_performance',false);

insert into public.scene_challenge_cycles
(id,city_id,cadence,starts_at,ends_at,target_total,status,art_version)
values
('40000000-0000-0000-0000-000000000071',
 '20000000-0000-0000-0000-000000000071','weekly',
 date_trunc('week',now() at time zone 'UTC') - interval '14 days',
 date_trunc('week',now() at time zone 'UTC') - interval '7 days',
 4,'expired',1),
('40000000-0000-0000-0000-000000000072',
 '20000000-0000-0000-0000-000000000071','weekly',
 date_trunc('week',now() at time zone 'UTC'),
 date_trunc('week',now() at time zone 'UTC') + interval '7 days',
 4,'active',1),
('40000000-0000-0000-0000-000000000073',
 '20000000-0000-0000-0000-000000000071','daily',
 date_trunc('day',now() at time zone 'UTC') - interval '2 days',
 date_trunc('day',now() at time zone 'UTC') - interval '1 day',
 4,'completed',1),
('40000000-0000-0000-0000-000000000074',
 '20000000-0000-0000-0000-000000000072','weekly',
 date_trunc('week',now() at time zone 'UTC') - interval '14 days',
 date_trunc('week',now() at time zone 'UTC') - interval '7 days',
 4,'expired',1);

insert into public.scene_challenge_objectives(id,cycle_id,template_id,target_points)
select '50000000-0000-0000-0000-000000000071',
       '40000000-0000-0000-0000-000000000071',id,4
from public.scene_challenge_templates where slug='legacy-weekly-ci';
insert into public.scene_challenge_objectives(id,cycle_id,template_id,target_points)
select '50000000-0000-0000-0000-000000000073',
       '40000000-0000-0000-0000-000000000073',id,4
from public.scene_challenge_templates where slug='legacy-daily-ci';

insert into public.scene_contributions
(objective_id,account_id,profile_id,city_id,source_type,source_event_id,source_completed_at,points)
values
('50000000-0000-0000-0000-000000000071',
 '10000000-0000-0000-0000-000000000071',
 '30000000-0000-0000-0000-000000000071',
 '20000000-0000-0000-0000-000000000071',
 'gig:verified_performance','legacy-w-01',
 date_trunc('week',now() at time zone 'UTC') - interval '12 days',2),
('50000000-0000-0000-0000-000000000073',
 '10000000-0000-0000-0000-000000000071',
 '30000000-0000-0000-0000-000000000071',
 '20000000-0000-0000-0000-000000000071',
 'gig:verified_performance','legacy-d-01',
 date_trunc('day',now() at time zone 'UTC') - interval '2 days' + interval '12 hours',1);

insert into public.scene_milestones(cycle_id,percent_threshold,art_version,revoked_at)
values
 ('40000000-0000-0000-0000-000000000071',25,1,null),
 ('40000000-0000-0000-0000-000000000071',50,1,now()),
 ('40000000-0000-0000-0000-000000000072',25,1,null),
 ('40000000-0000-0000-0000-000000000073',25,1,null);

do $$
declare
  v_week jsonb;
  v_daily jsonb;
  v_other jsonb;
  v_rejected boolean := false;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000071',true);
  v_week:=public.get_city_scene_legacy('20000000-0000-0000-0000-000000000071','weekly',8);
  if jsonb_array_length(v_week->'cycles') <> 1
    or (v_week->'cycles'->0->>'cycle_id') <> '40000000-0000-0000-0000-000000000071'
    or (v_week->'cycles'->0->>'target_total')::int <> 4
    or (v_week->'cycles'->0->>'earned_points')::int <> 2
    or v_week->'cycles'->0->'milestones' <> '[25]'::jsonb then
    raise exception 'Legacy weekly archive includes unfinished/revoked cycles or wrong score: %',v_week;
  end if;

  v_daily:=public.get_city_scene_legacy('20000000-0000-0000-0000-000000000071','daily',8);
  if jsonb_array_length(v_daily->'cycles') <> 1
    or (v_daily->'cycles'->0->>'cycle_id') <> '40000000-0000-0000-0000-000000000073'
    or (v_daily->'cycles'->0->>'earned_points')::int <> 1 then
    raise exception 'Daily/weekly cadence isolation failed: %',v_daily;
  end if;

  v_other:=public.get_city_scene_legacy('20000000-0000-0000-0000-000000000072','weekly',8);
  if jsonb_array_length(v_other->'cycles') <> 1
    or (v_other->'cycles'->0->>'earned_points')::int <> 0 then
    raise exception 'Cross-city legacy filter failed: %',v_other;
  end if;

  if v_week::text like '%10000000-0000-0000-0000-000000000071%'
     or v_week::text like '%30000000-0000-0000-0000-000000000071%'
     or v_week::text like '%legacy-w-01%' then
    raise exception 'Legacy RPC exposed private identity or source event';
  end if;

  begin
    perform public.get_city_scene_legacy('20000000-0000-0000-0000-000000000071','monthly',8);
  exception when invalid_parameter_value then v_rejected:=true;
  end;
  if not v_rejected then raise exception 'Unexpected monthly cadence accepted'; end if;

  if exists(select 1 from public.scene_reward_grant_receipts)
     or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled) then
    raise exception 'Historical archive touched XP payout gates';
  end if;
end;
$$;
rollback;
