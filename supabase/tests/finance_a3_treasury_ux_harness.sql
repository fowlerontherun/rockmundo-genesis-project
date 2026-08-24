-- Finance A3 static/behavioural contract checks.
-- Expected to run after a clean migration reset.

select to_regprocedure('public.ensure_my_band_treasury(uuid)') is not null
  as treasury_recovery_rpc_exists;

select has_function_privilege(
  'authenticated',
  'public.ensure_my_band_treasury(uuid)',
  'execute'
) as authenticated_can_run_treasury_recovery;

select exists (
  select 1
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'band_treasuries'
    and t.tgname = 'band_treasury_sync_legacy_balance_projection'
    and not t.tgisinternal
) as legacy_balance_projection_trigger_exists;

select not exists (
  select 1
  from public.bands b
  join lateral (
    select t.balance_minor, t.reserved_balance_minor
    from public.band_treasuries t
    where t.band_id = b.id
    order by t.is_primary desc, t.created_at asc
    limit 1
  ) t on true
  where b.band_balance is distinct from
    (((t.balance_minor - t.reserved_balance_minor) / 100)::integer)
) as legacy_band_balance_matches_available_treasury;

select not exists (
  select 1
  from public.bands b
  where not exists (
    select 1 from public.band_treasuries t where t.band_id = b.id
  )
  and coalesce(b.band_balance, 0) <> 0
) as missing_treasury_cannot_leave_stale_positive_projection;
