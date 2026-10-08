-- Follow-up for installations that have already applied the original audit migration.
-- Replaces the trigger logic without changing existing Twaat records.
create or replace function public.audit_twaater_referral_publication()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_query text;
  v_ref text;
begin
  if new.deleted_at is not null or new.scheduled_for is not null or new.visibility <> 'public' or new.moderation_status <> 'approved' then
    delete from public.twaater_referral_publications where twaat_id = new.id;
    return new;
  end if;
  v_url := (regexp_match(new.body, 'https://rockmundo[.]uk/auth[?][^[:space:]]+'))[1];
  v_query := split_part(coalesce(v_url, ''), '?', 2);
  v_ref := upper((regexp_match(v_query, '(^|&)ref=([a-zA-Z0-9_-]+)'))[2]);
  if v_ref is null or length(v_ref) not between 6 and 20 or not exists (
    select 1 from public.referral_codes where code = v_ref
  ) then
    delete from public.twaater_referral_publications where twaat_id = new.id;
    return new;
  end if;
  insert into public.twaater_referral_publications(twaat_id, referral_code, campaign, creative, published_at)
  values (
    new.id,
    v_ref,
    left(lower((regexp_match(v_query, '(^|&)campaign=([a-zA-Z0-9_-]+)'))[2]), 40),
    left(lower((regexp_match(v_query, '(^|&)creative=([a-zA-Z0-9_-]+)'))[2]), 40),
    coalesce(new.scheduled_published_at, now())
  )
  on conflict(twaat_id) do update
  set referral_code = excluded.referral_code,
      campaign = excluded.campaign,
      creative = excluded.creative;
  return new;
end;
$$;

-- The trigger is internal: prevent direct API-role invocation of its definer privileges.
revoke all on function public.audit_twaater_referral_publication() from public, anon, authenticated;

drop trigger if exists trg_audit_twaater_referral_publication on public.twaats;
create trigger trg_audit_twaater_referral_publication
after insert or update of body, visibility, deleted_at, scheduled_for, moderation_status on public.twaats
for each row execute function public.audit_twaater_referral_publication();


-- Restore audit rows for eligible posts that predate this follow-up.
-- This also handles deployments that ran the original migration before validation existed.
insert into public.twaater_referral_publications
  (twaat_id, referral_code, campaign, creative, published_at)
select
  t.id,
  rc.code,
  left(lower((regexp_match(split_part(m.url, '?', 2), '(^|&)campaign=([a-zA-Z0-9_-]+)'))[2]), 40),
  left(lower((regexp_match(split_part(m.url, '?', 2), '(^|&)creative=([a-zA-Z0-9_-]+)'))[2]), 40),
  coalesce(t.scheduled_published_at, t.created_at, now())
from public.twaats t
cross join lateral (
  select (regexp_match(t.body, 'https://rockmundo[.]uk/auth[?][^[:space:]]+'))[1] as url
) m
join public.referral_codes rc
  on rc.code = upper((regexp_match(split_part(m.url, '?', 2), '(^|&)ref=([a-zA-Z0-9_-]+)'))[2])
where t.scheduled_for is null
  and t.deleted_at is null
  and t.visibility = 'public'
  and t.moderation_status = 'approved'
  and m.url is not null
on conflict (twaat_id) do update
set referral_code = excluded.referral_code,
    campaign = excluded.campaign,
    creative = excluded.creative;

-- Remove records no longer eligible under the validated publication rules.
delete from public.twaater_referral_publications p
where not exists (
  select 1 from public.twaats t
  join public.referral_codes rc on rc.code = p.referral_code
  where t.id = p.twaat_id
    and t.deleted_at is null
    and t.scheduled_for is null
    and t.visibility = 'public'
    and t.moderation_status = 'approved'
);
