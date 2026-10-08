-- Repair stale referral RPC references to the removed public.profiles.name column.
-- Keep legitimate band/company/etc name columns untouched.

do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_get_referral_audit',
        'get_band_referral_recruits',
        'get_my_referral_recruits',
        'get_my_referral_welcome',
        'refresh_referral_qualification',
        'refresh_referral_vip_eligibility'
      )
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'p.display_name,p.username,p.name', 'p.display_name,p.username');
    v_def := replace(v_def, 'p.display_name, p.username, p.name', 'p.display_name, p.username');
    v_def := replace(v_def, 'rp.display_name,rp.username,rp.name', 'rp.display_name,rp.username');
    v_def := replace(v_def, 'rp.display_name, rp.username, rp.name', 'rp.display_name, rp.username');
    v_def := replace(v_def, 'x.display_name,x.username,x.name', 'x.display_name,x.username');
    v_def := replace(v_def, 'x.display_name, x.username, x.name', 'x.display_name, x.username');
    v_def := replace(v_def, ',p.name,p.total_hours_played', ',p.total_hours_played');
    v_def := replace(v_def, ', p.name, p.total_hours_played', ', p.total_hours_played');
    v_def := replace(v_def, ',rp.name,rp.total_hours_played', ',rp.total_hours_played');
    v_def := replace(v_def, ', rp.name, rp.total_hours_played', ', rp.total_hours_played');
    execute v_def;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_get_referral_audit',
        'get_band_referral_recruits',
        'get_my_referral_recruits',
        'get_my_referral_welcome',
        'refresh_referral_qualification',
        'refresh_referral_vip_eligibility'
      )
      and pg_get_functiondef(p.oid) ~ '(^|[^a-zA-Z0-9_])(p|rp|x)\.name([^a-zA-Z0-9_]|$)'
  ) then
    raise exception 'stale profile name reference remains';
  end if;
end $$;
