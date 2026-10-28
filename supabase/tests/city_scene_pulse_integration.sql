-- Isolated PostgreSQL only: canonical source mapping, k=3 privacy,
-- revoked evidence exclusion and restricted public payload. All rolls back.
begin;

insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000051'),
 ('10000000-0000-0000-0000-000000000052'),
 ('10000000-0000-0000-0000-000000000053'),
 ('10000000-0000-0000-0000-000000000054');
insert into public.cities(id,name)
 values ('20000000-0000-0000-0000-000000000051','Scene Pulse Integration');
insert into public.profiles(id,user_id,current_city_id,is_active,last_login_at)
select ('30000000-0000-0000-0000-0000000000' || right(id::text,2))::uuid,
  id,'20000000-0000-0000-0000-000000000051',true,now()
from auth.users where id in (
 '10000000-0000-0000-0000-000000000051',
 '10000000-0000-0000-0000-000000000052',
 '10000000-0000-0000-0000-000000000053',
 '10000000-0000-0000-0000-000000000054'
);

insert into public.scene_challenge_templates(slug,cadence,title,action_type,enabled)
values('weekly-scene-pulse-privacy-test','weekly','Pulse Integration','gig:verified_performance',false);
insert into public.scene_challenge_cycles
 (id,city_id,cadence,starts_at,ends_at,target_total,status)
values ('40000000-0000-0000-0000-000000000051',
 '20000000-0000-0000-0000-000000000051','weekly',
 date_trunc('week',now() at time zone 'UTC') at time zone 'UTC',
 (date_trunc('week',now() at time zone 'UTC') + interval '7 days') at time zone 'UTC',
 10,'active');
insert into public.scene_challenge_objectives(id,cycle_id,template_id,target_points)
select '50000000-0000-0000-0000-000000000051',
 '40000000-0000-0000-0000-000000000051',id,10
from public.scene_challenge_templates where slug='weekly-scene-pulse-privacy-test';

-- Same verified gig event with three real accounts produces three distinct
-- contributions; a completed recording with one account stays suppressed.
insert into public.scene_contributions
 (objective_id,account_id,profile_id,city_id,source_type,source_event_id,source_completed_at,points)
values
 ('50000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000051','30000000-0000-0000-0000-000000000051','20000000-0000-0000-0000-000000000051','verified_gig_performance','verified-gig-51',now(),1),
 ('50000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000052','30000000-0000-0000-0000-000000000052','20000000-0000-0000-0000-000000000051','verified_gig_performance','verified-gig-51',now(),1),
 ('50000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000053','30000000-0000-0000-0000-000000000053','20000000-0000-0000-0000-000000000051','verified_gig_performance','verified-gig-51',now(),1),
 ('50000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000051','30000000-0000-0000-0000-000000000051','20000000-0000-0000-0000-000000000051','completed_recording','recording-51',now(),1),
 ('50000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000052','30000000-0000-0000-0000-000000000052','20000000-0000-0000-0000-000000000051','verified_rehearsal','rehearsal-51',now(),1),
 ('50000000-0000-0000-0000-000000000051','10000000-0000-0000-0000-000000000054','30000000-0000-0000-0000-000000000054','20000000-0000-0000-0000-000000000051','verified_gig_performance','revoked-gig-51',now(),1);

update public.scene_contributions
 set invalidated_at=now()
 where source_event_id='revoked-gig-51';

do $$
declare
  v_result jsonb;
  v_entries jsonb;
begin
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000051',true);
  v_result:=public.get_city_scene_pulse('20000000-0000-0000-0000-000000000051','weekly',12);
  v_entries:=v_result->'entries';
  if jsonb_array_length(v_entries)<>1
    or v_entries->0->>'kind'<>'activity'
    or v_entries->0->>'action_type'<>'gig:verified_performance'
    or (v_entries->0->>'actions')::int<>3 then
    raise exception 'Verified gig mapping or k=3 suppression broken: %',v_result;
  end if;
  if v_entries::text like '%verified_gig_performance%'
    or v_entries::text like '%10000000-0000-0000%'
    or v_entries::text like '%source_event_id%'
    or v_entries::text like '%recording-51%'
    or v_entries::text like '%rehearsal-51%' then
    raise exception 'Scene Pulse leaks private evidence or internal source codes: %',v_entries;
  end if;
  if exists(select 1 from public.scene_reward_payout_controls where payouts_enabled)
    or exists(select 1 from public.scene_reward_grant_receipts) then
    raise exception 'Pulse integration modified XP reward safety state';
  end if;
end;
$$;
rollback;
