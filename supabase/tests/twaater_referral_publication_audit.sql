-- Read-only validation for the publication audit migration.
-- Run after applying 20261008110000_twaater_referral_publication_audit.sql.
do $$
begin
  if to_regclass('public.twaater_referral_publications') is null then
    raise exception 'Publication audit table is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='twaater_referral_publications' and c.relrowsecurity
  ) then
    raise exception 'Publication audit RLS must be enabled';
  end if;
  if has_function_privilege('anon', 'public.audit_twaater_referral_publication()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.audit_twaater_referral_publication()', 'EXECUTE') then
    raise exception 'Publication audit trigger must not be executable by API roles';
  end if;
  if exists (
    select 1 from public.twaater_referral_publications p
    join public.twaats t on t.id=p.twaat_id
    where t.scheduled_for is not null or t.deleted_at is not null or t.visibility <> 'public'
  ) then
    raise exception 'Audit contains scheduled, deleted or non-public Twaats';
  end if;
  if exists (
    select 1 from public.twaater_referral_publications p
    where not exists (select 1 from public.referral_codes c where c.code=p.referral_code)
  ) then
    raise exception 'Audit contains unknown referral codes';
  end if;
end;
$$;
