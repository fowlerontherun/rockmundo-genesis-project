\set ON_ERROR_STOP on

-- E1 is deployed directly to the target database by request. This harness is
-- deliberately verification-only: it creates no migration history and writes
-- no fixture data.

do $$
declare
  v_table text;
  v_oid oid;
  v_signature text;
  v_expected_tables constant text[] := array[
    'tour_operation_templates',
    'tour_operation_states',
    'tour_budget_ledger',
    'tour_equipment_manifest',
    'tour_crew_schedules',
    'tour_merchandise_plans',
    'tour_sponsor_obligations',
    'tour_logistics_events',
    'tour_completion_reports',
    'tour_operation_requests'
  ];
  v_expected_functions constant text[] := array[
    'public.get_tour_operations_workspace(uuid)',
    'public.save_tour_operation_template(uuid,jsonb,uuid)',
    'public.save_tour_operations_plan(uuid,bigint,jsonb,uuid)',
    'public.apply_tour_operation_template(uuid,uuid,bigint,uuid)',
    'public.record_tour_logistics_event(uuid,text,uuid,text,uuid)',
    'public.resolve_tour_logistics_event(uuid,uuid,uuid)',
    'public.complete_tour_operations_report(uuid,uuid)'
  ];
begin
  foreach v_table in array v_expected_tables loop
    select c.oid
      into v_oid
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = v_table
       and c.relkind = 'r';

    if v_oid is null then
      raise exception 'E1 table is missing: %', v_table;
    end if;

    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = v_oid) then
      raise exception 'RLS is disabled on public.%', v_table;
    end if;

    if has_table_privilege('authenticated', v_oid, 'SELECT')
       or has_table_privilege('authenticated', v_oid, 'INSERT')
       or has_table_privilege('authenticated', v_oid, 'UPDATE')
       or has_table_privilege('authenticated', v_oid, 'DELETE')
       or has_table_privilege('anon', v_oid, 'SELECT')
       or has_table_privilege('anon', v_oid, 'INSERT')
       or has_table_privilege('anon', v_oid, 'UPDATE')
       or has_table_privilege('anon', v_oid, 'DELETE') then
      raise exception 'Direct browser table privileges remain on public.%', v_table;
    end if;
  end loop;

  foreach v_signature in array v_expected_functions loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then
      raise exception 'E1 RPC is missing: %', v_signature;
    end if;

    if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_oid) then
      raise exception 'E1 RPC must retain its reviewed SECURITY DEFINER boundary: %', v_signature;
    end if;

    if not coalesce(
      (select p.proconfig @> array['search_path=pg_catalog, public, pg_temp']
         from pg_catalog.pg_proc p
        where p.oid = v_oid),
      false
    ) then
      raise exception 'E1 RPC has an unsafe search_path: %', v_signature;
    end if;

    if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
      raise exception 'Authenticated clients cannot execute E1 RPC: %', v_signature;
    end if;

    if has_function_privilege('anon', v_oid, 'EXECUTE') then
      raise exception 'Anonymous clients can execute E1 RPC: %', v_signature;
    end if;
  end loop;
end
$$;

select 'E1 Tour HQ direct database contract verified' as result;
