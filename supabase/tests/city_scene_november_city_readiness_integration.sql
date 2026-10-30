-- Isolated PostgreSQL fixture, NEVER run against live data.
-- Tests monthly partial launches and service-only eligibility snapshots.
begin;

do $$
begin
  if (select count(*) from public.cities) <> 1
    or exists (select 1 from public.scene_challenge_cycles) then
    raise exception 'NOVEMBER_READINESS_REQUIRES_ISOLATED_CI_DATABASE';
  end if;
  if has_function_privilege('anon','private.scene_november_city_readiness()','EXECUTE')
    or has_function_privilege('authenticated','private.scene_november_city_readiness()','EXECUTE')
    or not has_function_privilege('service_role','private.scene_november_city_readiness()','EXECUTE') then
    raise exception 'City readiness exposes operator data to players';
  end if;
  if not has_schema_privilege('service_role','private','USAGE')
    or has_schema_privilege('authenticated','private','USAGE')
    or has_schema_privilege('anon','private','USAGE') then
    raise exception 'Private schema privilege boundary is broken';
  end if;
  if (select prosecdef from pg_proc
    where oid = 'private.scene_november_city_readiness()'::regprocedure) then
    raise exception 'City readiness must not be SECURITY DEFINER';
  end if;
end;
$$;

insert into auth.users (id) values ('10000000-0000-0000-0000-000000000002');
insert into public.cities (id,name)
values ('20000000-0000-0000-0000-000000000002','Second Pilot City');
insert into public.profiles (id,user_id,current_city_id,is_active,last_login_at)
values ('30000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000002',true,now());

do $$
begin
  if (select count(*) from private.scene_november_city_readiness()) <> 2
    or (select count(*) from private.scene_november_city_readiness()
        where readiness='awaiting_worker' and recently_active_accounts=1
          and projected_target_points=3) <> 2 then
    raise exception 'Monthly preflight lost active, unique-account eligible cities';
  end if;
end;
$$;

insert into public.scene_challenge_cycles
(id,city_id,cadence,starts_at,ends_at,target_total,status)
values ('40000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        'monthly',timestamptz '2026-11-01 00:00:00+00',
        timestamptz '2026-12-01 00:00:00+00',3,'active');

do $$
begin
  if not exists(
      select 1 from private.scene_november_city_readiness()
      where city_name='Staging Music City'
        and november_cycle_count=1 and november_objective_count=0
        and readiness='bad_objective_count'
    ) or not exists (
      select 1 from private.scene_november_city_readiness()
      where city_name='Second Pilot City'
        and november_cycle_count=0 and readiness='awaiting_worker'
    ) then
    raise exception 'Partial city launch or missing objectives not detected';
  end if;
end;
$$;

insert into public.scene_challenge_objectives(cycle_id,template_id,target_points)
select '40000000-0000-0000-0000-000000000002',id,3
from public.scene_challenge_templates
where cadence='monthly' order by slug limit 1;

do $$
begin
  if not exists (
      select 1 from private.scene_november_city_readiness()
      where city_name='Staging Music City' and readiness='created'
        and november_objective_count=1
    ) or not exists (
      select 1 from private.scene_november_city_readiness()
      where city_name='Second Pilot City' and readiness='awaiting_worker'
    ) then
    raise exception 'Partial monthly launch was hidden once one city was created';
  end if;
  if exists (select 1 from public.scene_reward_payout_controls where payouts_enabled)
    or exists (select 1 from public.scene_reward_grant_receipts) then
    raise exception 'Read-only preflight changed reward data';
  end if;
end;
$$;

rollback;
