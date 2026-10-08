-- Server-backed receipts keep Share Studio cooldowns tied to actual Twaater publication.
create table if not exists public.twaater_share_publication_receipts (
  twaat_id uuid primary key references public.twaats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cooldown_key text not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists twaater_share_publication_receipts_user_ack_idx
  on public.twaater_share_publication_receipts(user_id, acknowledged_at, created_at desc);

alter table public.twaater_share_publication_receipts enable row level security;
revoke all on public.twaater_share_publication_receipts from public, anon, authenticated;

create or replace function public.register_twaater_share_publication_receipt(
  p_twaat_id uuid,
  p_cooldown_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_cooldown_key is null
     or length(p_cooldown_key) not between 8 and 120
     or p_cooldown_key !~ '^rockmundo_[a-z0-9_]+_share_at$'
  then
    raise exception 'Invalid share cooldown key';
  end if;

  select t.account_id into v_account_id
  from public.twaats t
  where t.id = p_twaat_id;

  if v_account_id is null then raise exception 'Twaat not found'; end if;

  if not exists (
    select 1
    from public.twaater_accounts a
    where a.id = v_account_id
      and (
        (
          a.owner_type = 'persona'
          and exists (
            select 1 from public.profiles p
            where p.id = a.owner_id
              and p.user_id = v_user_id
              and coalesce(p.is_active,true)
              and p.died_at is null
          )
        )
        or
        (
          a.owner_type = 'band'
          and exists (
            select 1 from public.band_members bm
            where bm.band_id = a.owner_id
              and bm.user_id = v_user_id
              and coalesce(bm.member_status,'active') = 'active'
          )
        )
      )
  ) then
    raise exception 'Twaat does not belong to caller';
  end if;

  insert into public.twaater_share_publication_receipts(twaat_id,user_id,cooldown_key)
  values(p_twaat_id,v_user_id,p_cooldown_key)
  on conflict(twaat_id) do update
    set cooldown_key = excluded.cooldown_key,
        user_id = excluded.user_id,
        acknowledged_at = null;

  return true;
end;
$$;

revoke all on function public.register_twaater_share_publication_receipt(uuid,text) from public, anon;
grant execute on function public.register_twaater_share_publication_receipt(uuid,text) to authenticated;

create or replace function public.consume_my_published_share_receipts()
returns table(
  twaat_id uuid,
  cooldown_key text,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  return query
  with published as (
    select
      r.twaat_id,
      r.cooldown_key,
      coalesce(t.scheduled_published_at,t.created_at,now()) as published_at
    from public.twaater_share_publication_receipts r
    join public.twaats t on t.id = r.twaat_id
    where r.user_id = v_user_id
      and r.acknowledged_at is null
      and t.scheduled_for is null
      and t.deleted_at is null
      and t.visibility = 'public'
      and t.moderation_status = 'approved'
    order by coalesce(t.scheduled_published_at,t.created_at,now())
    for update of r skip locked
  ),
  acknowledged as (
    update public.twaater_share_publication_receipts r
    set acknowledged_at = now()
    from published p
    where r.twaat_id = p.twaat_id
    returning r.twaat_id
  )
  select p.twaat_id,p.cooldown_key,p.published_at
  from published p
  join acknowledged a using(twaat_id);
end;
$$;

revoke all on function public.consume_my_published_share_receipts() from public, anon;
grant execute on function public.consume_my_published_share_receipts() to authenticated;
