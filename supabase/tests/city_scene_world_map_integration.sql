-- Isolated CI-only map layer: only confirmed non-revoked stages leave RPC.
-- Tests monthly precedence over weekly and skips expired campaigns.
begin;

do $$
begin
  if has_function_privilege('anon','public.get_world_city_scene_status()','EXECUTE') then
    raise exception 'Anonymous users can read World Scene status';
  end if;
  if not has_function_privilege('authenticated','public.get_world_city_scene_status()','EXECUTE') then
    raise exception 'Authenticated player cannot read World Scene status';
  end if;
end;
$$;

insert into public.cities(id,name) values
('20000000-0000-0000-0000-000000000081','World Scene Mural A'),
('20000000-0000-0000-0000-000000000082','World Scene Mural B'),
('20000000-0000-0000-0000-000000000083','World Scene Mural C');

insert into public.scene_challenge_cycles
(id,city_id,cadence,starts_at,ends_at,target_total,status)
values
('40000000-0000-0000-0000-000000000081',
 '20000000-0000-0000-0000-000000000081','weekly',
 now()-interval '2 days',now()+interval '2 days',3,'active'),
('40000000-0000-0000-0000-000000000082',
 '20000000-0000-0000-0000-000000000081','monthly',
 now()-interval '2 days',now()+interval '2 days',6,'active'),
('40000000-0000-0000-0000-000000000083',
 '20000000-0000-0000-0000-000000000082','weekly',
 now()-interval '2 days',now()+interval '2 days',3,'active'),
('40000000-0000-0000-0000-000000000084',
 '20000000-0000-0000-0000-000000000083','weekly',
 now()-interval '7 days',now()-interval '2 days',3,'active');

insert into public.scene_milestones(cycle_id,percent_threshold,art_version,revoked_at) values
('40000000-0000-0000-0000-000000000081',25,1,null),
('40000000-0000-0000-0000-000000000082',50,1,null),
('40000000-0000-0000-0000-000000000082',75,1,now()),
('40000000-0000-0000-0000-000000000084',100,1,null);

do $$
declare
  v_data jsonb;
  v_city_a jsonb;
  v_city_b jsonb;
  v_city_c jsonb;
begin
  perform set_config('request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',true);

  v_data := public.get_world_city_scene_status();
  select item into v_city_a from jsonb_array_elements(v_data->'cities') item
  where item->>'city_id'='20000000-0000-0000-0000-000000000081';
  select item into v_city_b from jsonb_array_elements(v_data->'cities') item
  where item->>'city_id'='20000000-0000-0000-0000-000000000082';
  select item into v_city_c from jsonb_array_elements(v_data->'cities') item
  where item->>'city_id'='20000000-0000-0000-0000-000000000083';

  if v_city_a is null
    or v_city_a->>'cadence'<>'monthly'
    or (v_city_a->>'confirmed_stage')::integer<>50 then
    raise exception 'Monthly must supersede weekly without revoked 75%% stage: %',v_city_a;
  end if;
  if v_city_b is null or (v_city_b->>'confirmed_stage')::integer<>0 then
    raise exception 'Active city without an unlocked mural should have zero confirmed stage: %',v_city_b;
  end if;
  if v_city_c is not null then
    raise exception 'Ended campaign leaked onto world map: %',v_city_c;
  end if;
  if (select count(*) from jsonb_array_elements(v_data->'cities') item
      where item->>'city_id'='20000000-0000-0000-0000-000000000081')<>1 then
    raise exception 'Multiple campaigns shown for one city';
  end if;
  if (select count(*) from jsonb_object_keys(v_city_a))<>4
    or not (v_city_a ?& array['city_id','cadence','ends_at','confirmed_stage'])
    or v_data::text ~ '(account_id|profile_id|source_event_id|earned_points)' then
    raise exception 'World map exposes more than public mural milestone data: %',v_city_a;
  end if;
  if exists(select 1 from public.scene_reward_grant_receipts)
    or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled) then
    raise exception 'Read-only World Scene map mutated payout state';
  end if;
end;
$$;

rollback;
