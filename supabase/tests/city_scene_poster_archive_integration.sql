-- CI-only monthly rollover: public poster history, revoked milestone
-- suppression, no in-progress month leakage and zero XP effects.
begin;

do $$
begin
  if has_function_privilege('anon','public.get_city_scene_poster_archive(uuid,integer)','EXECUTE') then
    raise exception 'Monthly archive accessible to anonymous role';
  end if;
end;
$$;

insert into auth.users(id) values('10000000-0000-0000-0000-000000000051');
insert into public.cities(id,name)
values('20000000-0000-0000-0000-000000000051','Historic Poster City');
insert into public.profiles(id,user_id,current_city_id,is_active,last_login_at)
values('30000000-0000-0000-0000-000000000051',
 '10000000-0000-0000-0000-000000000051',
 '20000000-0000-0000-0000-000000000051',true,now());

insert into public.scene_challenge_templates(slug,cadence,title,action_type,enabled)
values('monthly-poster-history-ci','monthly','Poster History Test',
 'gig:verified_performance',false);

insert into public.scene_challenge_cycles
(id,city_id,cadence,starts_at,ends_at,target_total,status,art_version)
values
('40000000-0000-0000-0000-000000000051',
 '20000000-0000-0000-0000-000000000051','monthly',
 date_trunc('month',now() at time zone 'UTC') - interval '2 months',
 date_trunc('month',now() at time zone 'UTC') - interval '1 month',
 4,'expired',1),
('40000000-0000-0000-0000-000000000052',
 '20000000-0000-0000-0000-000000000051','monthly',
 date_trunc('month',now() at time zone 'UTC'),
 date_trunc('month',now() at time zone 'UTC') + interval '1 month',
 4,'active',1);

insert into public.scene_challenge_objectives(id,cycle_id,template_id,target_points)
select '50000000-0000-0000-0000-000000000051',
 '40000000-0000-0000-0000-000000000051',id,4
from public.scene_challenge_templates where slug='monthly-poster-history-ci';

insert into public.scene_contributions
(objective_id,account_id,profile_id,city_id,source_type,source_event_id,source_completed_at,points)
values
('50000000-0000-0000-0000-000000000051',
 '10000000-0000-0000-0000-000000000051',
 '30000000-0000-0000-0000-000000000051',
 '20000000-0000-0000-0000-000000000051',
 'gig:verified_performance','poster-month-ci',
 date_trunc('month',now() at time zone 'UTC') - interval '2 months' + interval '4 days',2);

insert into public.scene_milestones(cycle_id,percent_threshold,art_version,revoked_at)
values
 ('40000000-0000-0000-0000-000000000051',25,1,null),
 ('40000000-0000-0000-0000-000000000051',50,1,now()),
 ('40000000-0000-0000-0000-000000000052',25,1,null);

do $$
declare
  v jsonb;
  v_history jsonb;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000051',true);
  v:=public.get_city_scene_poster_archive('20000000-0000-0000-0000-000000000051',12);
  v_history:=v->'posters';
  if jsonb_array_length(v_history)<>1 then
    raise exception 'Active monthly poster leaked into archive: %',v;
  end if;
  if (v_history->0->>'cycle_id')<>'40000000-0000-0000-0000-000000000051'
    or (v_history->0->>'target_total')::int<>4
    or (v_history->0->>'earned_points')::int<>2
    or v_history->0->'milestones'<>'[25]'::jsonb then
    raise exception 'Archive monthly score or milestone revocation incorrect: %',v;
  end if;
  if v_history::text like '%10000000-0000-0000-0000-000000000051%'
    or v_history::text like '%poster-month-ci%' then
    raise exception 'Historic archive leaked account or source metadata: %',v;
  end if;
  if exists(select 1 from public.scene_reward_grant_receipts)
    or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled) then
    raise exception 'Archive changed XP reward state';
  end if;
end;
$$;
rollback;
