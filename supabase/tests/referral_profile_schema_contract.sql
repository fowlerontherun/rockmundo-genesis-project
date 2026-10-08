-- Regression guard for referral RPCs depending on removed profile columns.
-- The canonical player display fields are public.profiles.display_name and username.

do $$
declare
  v_missing text[];
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='name'
  ) then
    raise exception 'profiles.name unexpectedly exists; referral contract guard needs review';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and pg_get_functiondef(p.oid) ilike '%referral%'
      and pg_get_functiondef(p.oid) ~ '(^|[^a-zA-Z0-9_])(p|rp|x)\.name([^a-zA-Z0-9_]|$)'
  ) then
    raise exception 'A referral function still references removed public.profiles.name';
  end if;

  select array_agg(required.proname order by required.proname) into v_missing
  from (values
    ('get_referral_dashboard'),
    ('get_my_referral_recruits'),
    ('get_my_referral_welcome'),
    ('get_band_referral_recruits'),
    ('refresh_referral_qualification'),
    ('refresh_referral_vip_eligibility'),
    ('admin_get_referral_audit')
  ) as required(proname)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=required.proname
  );

  if v_missing is not null then
    raise exception 'Required referral RPCs missing: %', array_to_string(v_missing, ', ');
  end if;

  if not has_function_privilege('authenticated','public.get_referral_dashboard(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_my_referral_recruits(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_my_referral_welcome(uuid)','EXECUTE') then
    raise exception 'Authenticated referral read RPC grants are incomplete';
  end if;
end;
$$;
