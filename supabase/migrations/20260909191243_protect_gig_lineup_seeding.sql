-- Limit the lineup writer after reviewing the vocal-duty snapshot change.
create or replace function public.seed_gig_performers(p_gig_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gig public.gigs%rowtype;
  v_count integer := 0;
begin
  select * into v_gig from public.gigs where id = p_gig_id;
  if not found or coalesce(v_gig.status, '') in ('cancelled','failed') then
    return 0;
  end if;

  -- Direct RPC calls must belong to this band's active performing membership.
  -- Database triggers/jobs and service-role booking keep their existing access.
  if auth.uid() is not null then
    if not exists (
      select 1 from public.band_members member
      join public.profiles profile on profile.id = member.profile_id
      where member.band_id = v_gig.band_id and profile.user_id = auth.uid()
        and coalesce(member.member_status, 'active') = 'active'
    ) then
      raise exception 'Only active band members can prepare this lineup' using errcode = '42501';
    end if;
  elsif coalesce(auth.jwt()->>'role', '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.gig_performers (
    gig_id, band_id, profile_id, role_or_instrument, lineup_status, selected_at
  )
  select
    v_gig.id,
    v_gig.band_id,
    bm.profile_id,
    public.stage_performer_duties(coalesce(bm.instrument_role, bm.role), bm.vocal_role),
    'selected',
    now()
  from public.band_members bm
  where bm.band_id = v_gig.band_id
    and bm.profile_id is not null
    and coalesce(bm.member_status, 'active') = 'active'
    and coalesce(bm.is_touring_member, false) = false
    and (bm.joined_at is null or bm.joined_at <= coalesce(v_gig.scheduled_date, now()))
  on conflict on constraint gig_performers_unique do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.seed_gig_performers(uuid) from public, anon;
grant execute on function public.seed_gig_performers(uuid) to authenticated, service_role;
-- Trigger functions are invoked by PostgreSQL, never as public RPC endpoints.
revoke all on function public.seed_gig_performers_on_insert() from public, anon, authenticated;
