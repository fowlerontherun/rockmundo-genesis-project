-- Server-side publication audit. This does not award referral rewards.
create table if not exists public.twaater_referral_publications (
  twaat_id uuid primary key references public.twaats(id) on delete cascade,
  referral_code text not null,
  campaign text,
  creative text,
  published_at timestamptz not null default now()
);
alter table public.twaater_referral_publications enable row level security;
revoke all on public.twaater_referral_publications from public, anon, authenticated;

create or replace function public.audit_twaater_referral_publication()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_query text;
  v_ref text;
begin
  if new.deleted_at is not null or new.scheduled_for is not null or new.visibility <> 'public' then
    delete from public.twaater_referral_publications where twaat_id = new.id;
    return new;
  end if;
  v_url := (regexp_match(new.body, 'https://rockmundo[.]uk/auth[?][^[:space:]]+'))[1];
  v_query := split_part(coalesce(v_url, ''), '?', 2);
  v_ref := upper((regexp_match(v_query, '(^|&)ref=([a-zA-Z0-9_-]+)'))[2]);
  if v_ref is null or length(v_ref) > 40 then
    delete from public.twaater_referral_publications where twaat_id = new.id;
    return new;
  end if;
  insert into public.twaater_referral_publications(twaat_id, referral_code, campaign, creative, published_at)
  values (
    new.id,
    v_ref,
    left(lower((regexp_match(v_query, '(^|&)campaign=([a-zA-Z0-9_-]+)'))[2]), 40),
    left(lower((regexp_match(v_query, '(^|&)creative=([a-zA-Z0-9_-]+)'))[2]), 40),
    coalesce(new.scheduled_published_at, new.created_at, now())
  )
  on conflict(twaat_id) do update
  set referral_code = excluded.referral_code,
      campaign = excluded.campaign,
      creative = excluded.creative,
      published_at = excluded.published_at;
  return new;
end;
$$;

drop trigger if exists trg_audit_twaater_referral_publication on public.twaats;
create trigger trg_audit_twaater_referral_publication
after insert or update of body, visibility, deleted_at, scheduled_for on public.twaats
for each row execute function public.audit_twaater_referral_publication();
