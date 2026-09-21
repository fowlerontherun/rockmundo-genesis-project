create or replace function public.is_label_team_member(p_label_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.labels l
    where l.id = p_label_id
      and (
        l.created_by = auth.uid()
        or l.owner_id in (select id from public.profiles where user_id = auth.uid())
      )
      and (
        p_roles is null
        or p_roles && array['owner','manager']::text[]
      )
  );
$$;
revoke all on function public.is_label_team_member(uuid, text[]) from public;
grant execute on function public.is_label_team_member(uuid, text[]) to authenticated;

create or replace function public.can_access_label_contract(p_contract_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.artist_label_contracts contract
    where contract.id = p_contract_id
      and (
        public.is_label_team_member(contract.label_id, null)
        or exists (
          select 1 from public.band_members
          where band_id = contract.band_id and user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles
          where id = contract.artist_profile_id and user_id = auth.uid()
        )
      )
  );
$$;
revoke all on function public.can_access_label_contract(uuid) from public;
grant execute on function public.can_access_label_contract(uuid) to authenticated;

create or replace function public.can_manage_label_contract(
  p_contract_id uuid,
  p_roles text[] default array['owner','manager']::text[]
)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.artist_label_contracts contract
    where contract.id = p_contract_id
      and public.is_label_team_member(contract.label_id, p_roles)
  );
$$;
revoke all on function public.can_manage_label_contract(uuid, text[]) from public;
grant execute on function public.can_manage_label_contract(uuid, text[]) to authenticated;