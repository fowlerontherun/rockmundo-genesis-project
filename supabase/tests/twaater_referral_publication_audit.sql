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

-- URL parsing regressions: only the canonical RockMundo auth referral URL counts.
do $$
declare
  sample record;
  parsed_code text;
begin
  for sample in
    select * from (values
      ('https://rockmundo.uk/auth?ref=ABC123', 'ABC123'),
      ('Join: https://rockmundo.uk/auth?campaign=launch&ref=ABC123&creative=poster', 'ABC123'),
      ('https://example.com/auth?ref=ABC123', null::text),
      ('https://rockmundo.uk/auth?campaign=launch', null::text),
      ('https://rockmundo.uk/auth?ref=', null::text)
    ) as v(body, expected_code)
  loop
    parsed_code := upper((regexp_match(
      split_part(coalesce((regexp_match(sample.body, 'https://rockmundo[.]uk/auth[?][^[:space:]]+'))[1], ''), '?', 2),
      '(^|&)ref=([a-zA-Z0-9_-]+)'
    ))[2]);
    if parsed_code is distinct from sample.expected_code then
      raise exception 'Referral URL parser mismatch for input %', sample.body;
    end if;
  end loop;
end;
$$;
