-- Preserve band-recruitment attribution server-side so the recruiter can see
-- which referred newcomers are ready for the normal in-game invitation flow.
create or replace function public.capture_referral_from_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_referrer uuid;
  v_band_id uuid;
begin
  v_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
  if v_code = '' then return new; end if;

  select user_id into v_referrer from public.referral_codes where code = v_code;
  if v_referrer is null or v_referrer = new.id then return new; end if;

  begin
    v_band_id := nullif(new.raw_user_meta_data ->> 'referral_band_id', '')::uuid;
  exception when invalid_text_representation then
    v_band_id := null;
  end;

  -- Only retain the band when the referrer is currently an active regular member.
  if v_band_id is not null and not exists (
    select 1 from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = v_band_id
      and p.user_id = v_referrer
      and coalesce(bm.member_status, 'active') = 'active'
      and coalesce(bm.is_touring_member, false) = false
  ) then
    v_band_id := null;
  end if;

  insert into public.referrals(referrer_user_id, referred_user_id, referral_code, metadata)
  values (
    v_referrer, new.id, v_code,
    jsonb_strip_nulls(jsonb_build_object('source', 'signup_metadata', 'band_id', v_band_id))
  )
  on conflict (referred_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.capture_referral_from_signup() from public, anon, authenticated;

create or replace function public.get_band_referral_recruits(p_band_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.band_members bm
    join public.profiles p on p.id = bm.profile_id
    where bm.band_id = p_band_id and p.user_id = v_user_id
      and coalesce(bm.member_status, 'active') = 'active'
      and coalesce(bm.is_touring_member, false) = false
  ) then raise exception 'Band membership required'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.bound_at desc), '[]'::jsonb) into v_result
  from (
    select
      r.id as referral_id,
      r.bound_at,
      r.signup_qualified_at,
      p.id as profile_id,
      coalesce(p.display_name, p.username, p.name, 'New musician') as profile_name,
      bi.id as invitation_id,
      bi.status as invitation_status,
      bi.created_at as invitation_created_at
    from public.referrals r
    join lateral (
      select rp.id, rp.display_name, rp.username, rp.name
      from public.profiles rp
      where rp.user_id = r.referred_user_id and coalesce(rp.is_active, true)
      order by rp.created_at asc limit 1
    ) p on true
    left join lateral (
      select i.id, i.status, i.created_at
      from public.band_invitations i
      where i.band_id = p_band_id
        and i.invited_user_id = r.referred_user_id
        and (i.invited_profile_id = p.id or i.invited_profile_id is null)
      order by i.created_at desc limit 1
    ) bi on true
    where r.referrer_user_id = v_user_id
      and r.metadata->>'band_id' = p_band_id::text
    limit 100
  ) x;
  return v_result;
end;
$$;

revoke all on function public.get_band_referral_recruits(uuid) from public, anon;
grant execute on function public.get_band_referral_recruits(uuid) to authenticated;
